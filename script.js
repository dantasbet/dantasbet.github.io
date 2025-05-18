// script.js (Frontend com TensorFlow.js para API Onix - CORRIGIDO)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 6000;
const MAX_CORES_API = 20;
const SIGNAL_COOLDOWN = 5000; // Cooldown para o mesmo gatilho (sequência de cores)
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações e Variáveis Globais ---
let model;
const SEQUENCE_LENGTH = 5;
const NUM_FEATURES_PER_COLOR = 2;
const NUM_CLASSES = 2;
let isTraining = false;
const ML_CONFIDENCE_THRESHOLD = 0.60; // Reduzido um pouco para mais sinais, ajuste conforme necessário

const COLOR_TO_INDEX_ML = { 'vermelho': 0, 'preto': 1 };
const INDEX_TO_COLOR_ML = { 0: 'vermelho', 1: 'preto' };

// --- Global State ---
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,        // String da sequência de cores que gerou o sinal (ML)
    timestampGerado: null,
    coresOrigemSinal: null,
    ehMartingale: false
};
let sinalOriginalParaMartingale = null; // Guarda info do sinal que falhou e precisa de Martingale
let ultimosGatilhosProcessados = {};
let ultimoSinalResolvidoInfo = {
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null,
    timestampResolvido: 0
};
let wins = parseInt(localStorage.getItem('roletaWins')) || 0;
let losses = parseInt(localStorage.getItem('roletaLosses')) || 0;
let greenWins = parseInt(localStorage.getItem('roletaGreenWins')) || 0;
let martingaleWins = parseInt(localStorage.getItem('roletaMartingaleWins')) || 0;
let lastStatsLogTime = Date.now();

// --- DOM Elements Cache ---
const statusDiv = document.getElementById('status');
const sinalTextoP = document.getElementById('sinal-texto');
const winsSpan = document.getElementById('wins');
const greenWinsSpan = document.getElementById('green-wins');
const lossesSpan = document.getElementById('losses');
const winRateSpan = document.getElementById('win-rate');
const casinoIframe = document.getElementById('casino-iframe');
const refreshIframeButton = document.getElementById('refresh-iframe');

// --- Funções Auxiliares de ML ---
function colorsToInputTensor(colorSequence) {
    const tensorData = [];
    for (const color of colorSequence) {
        if (color === 'vermelho') tensorData.push(1, 0);
        else if (color === 'preto') tensorData.push(0, 1);
        else tensorData.push(0.5, 0.5); // Placeholder para verde/inválido
    }
    return tf.tensor2d([tensorData], [1, SEQUENCE_LENGTH * NUM_FEATURES_PER_COLOR]);
}

function prepareTrainingData(historicoCores) {
    const xs_data = [];
    const ys_data = [];
    if (!historicoCores || historicoCores.length < SEQUENCE_LENGTH + 1) return { xs: null, ys: null };

    for (let i = 0; i <= historicoCores.length - (SEQUENCE_LENGTH + 1); i++) {
        const sequencia = historicoCores.slice(i + 1, i + 1 + SEQUENCE_LENGTH).reverse();
        const resultado = historicoCores[i];
        if ((resultado === 'vermelho' || resultado === 'preto') && !sequencia.includes('verde')) {
            const inputFeatures = [];
            for (const color of sequencia) {
                if (color === 'vermelho') inputFeatures.push(1, 0);
                else if (color === 'preto') inputFeatures.push(0, 1);
            }
            xs_data.push(inputFeatures);
            ys_data.push(COLOR_TO_INDEX_ML[resultado]);
        }
    }
    if (xs_data.length === 0) return { xs: null, ys: null };
    const xTensor = tf.tensor2d(xs_data, [xs_data.length, SEQUENCE_LENGTH * NUM_FEATURES_PER_COLOR]);
    const yTensor = tf.oneHot(tf.tensor1d(ys_data, 'int32'), NUM_CLASSES);
    return { xs: xTensor, ys: yTensor };
}

function createModelTF() {
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ inputShape: [SEQUENCE_LENGTH * NUM_FEATURES_PER_COLOR], units: 20, activation: 'relu' })); // Aumentado units
    newModel.add(tf.layers.dropout({ rate: 0.25 }));
    newModel.add(tf.layers.dense({ units: NUM_CLASSES, activation: 'softmax' }));
    newModel.compile({ optimizer: tf.train.adam(0.002), loss: 'categoricalCrossentropy', metrics: ['accuracy'] }); // Ajustado learning rate
    console.log("Modelo TensorFlow.js criado.");
    return newModel;
}

async function trainModelTF(historicoCores) {
    if (isTraining || typeof tf === 'undefined' || !model) return;
    if (!historicoCores || historicoCores.length < SEQUENCE_LENGTH + 1) return;

    const { xs, ys } = prepareTrainingData(historicoCores);
    if (!xs || xs.shape[0] === 0) { if(xs) xs.dispose(); if(ys) ys.dispose(); return; }

    isTraining = true;
    try {
        await model.fit(xs, ys, {
            epochs: 10, batchSize: Math.max(1, Math.floor(xs.shape[0] / 3) || 1), shuffle: true,
            callbacks: { onEpochEnd: (epoch, logs) => { /* console.log(`Época TF ${epoch+1}: L=${logs.loss.toFixed(3)} A=${logs.acc.toFixed(3)}`); */ } }
        });
    } catch (error) { console.error("Erro Treinamento TF.js:", error); }
    finally { isTraining = false; xs.dispose(); ys.dispose(); }
}

async function verificarSinalComML(coresRecentes) {
    if (typeof tf === 'undefined' || !model || !coresRecentes || coresRecentes.length < SEQUENCE_LENGTH) return [null, null, null];
    const sequenciaParaPrever = coresRecentes.slice(0, SEQUENCE_LENGTH).reverse();
    if (sequenciaParaPrever.includes('verde')) return [null, null, null];

    let inputTensor;
    try {
        inputTensor = colorsToInputTensor(sequenciaParaPrever);
        const prediction = model.predict(inputTensor);
        const predictionData = await prediction.data();
        tf.dispose(prediction);

        const probVermelho = predictionData[0]; const probPreto = predictionData[1];
        let sinalGerado = null;
        if (probVermelho > probPreto && probVermelho >= ML_CONFIDENCE_THRESHOLD) sinalGerado = 'vermelho';
        else if (probPreto > probVermelho && probPreto >= ML_CONFIDENCE_THRESHOLD) sinalGerado = 'preto';

        if (sinalGerado) {
            const confianca = Math.max(probVermelho, probPreto);
            // console.info(`SINAL ML: ${sinalGerado.toUpperCase()} (Conf: ${(confianca * 100).toFixed(1)}%) | Gatilho: [${sequenciaParaPrever.join(',')}]`);
            const coresGatilhoApiOrder = [...sequenciaParaPrever].reverse();
            return [sinalGerado, coresGatilhoApiOrder.join(','), coresGatilhoApiOrder];
        }
    } catch (error) { console.error("Erro na previsão ML:", error); }
    finally { if (inputTensor) inputTensor.dispose(); }
    return [null, null, null];
}

// --- Funções Principais do Bot ---
function updateStatus(message, isError = false, isSuccess = false) {
    if (statusDiv) {
        let iconClass = 'fa-info-circle'; let color = 'dodgerblue'; let titleMessage = `Info: ${message}`;
        if (isError) { iconClass = 'fa-times-circle'; color = 'crimson'; titleMessage = `Erro: ${message}`; }
        else if (isSuccess) { iconClass = 'fa-check-circle'; color = 'green'; titleMessage = `Status: ${message}`; }
        statusDiv.innerHTML = `<i class="fas ${iconClass}"></i>`; statusDiv.style.color = color; statusDiv.title = titleMessage;
    }
    if (isError) console.error(message);
}

async function obterCoresAPI() {
    try {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(API_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) { updateStatus(`Erro HTTP ${response.status} (Onix)`, true); return null; }
        const dados = await response.json();
        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                if (typeof identificarCor !== 'function') { updateStatus("Erro: `identificarCor` não definida.", true); return null; }
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) { updateStatus("Nenhuma cor válida (Onix).", true); return null; }
                return coresValidas;
            }
        }
        updateStatus("Dados API (Onix) formato inesperado.", true); return null;
    } catch (error) {
        if (error.name === 'AbortError') updateStatus("Timeout API (Onix).", true);
        else updateStatus(`ERRO FETCH (Onix): ${error.message.substring(0,30)}`, true); // Mensagem mais curta
        console.error("Erro fetch (Onix):", error); return null;
    }
}

// Função para definir e exibir um sinal (normal ou Martingale)
function definirSinalAtivo(sinalCor, gatilhoId, coresGatilho, ehMartingaleIntent) {
    if (!sinalCor) return false;
    const agora = Date.now();

    // Cooldown para o mesmo gatilho (sequência de cores)
    // Só se aplica se NÃO for um Martingale forçado
    if (!ehMartingaleIntent) {
        if (ultimosGatilhosProcessados[gatilhoId] && (agora - ultimosGatilhosProcessados[gatilhoId] < SIGNAL_COOLDOWN)) {
            return false; // Cooldown ativo
        }
        const foiResolvidoRecentemente = (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
                                       ultimoSinalResolvidoInfo.gatilhoPadrao === gatilhoId &&
                                       JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresGatilho);
        if (foiResolvidoRecentemente) {
            return false; // Resolvido recentemente
        }
    }

    ultimoSinal = {
        sinalEsperado: sinalCor,
        gatilhoPadrao: gatilhoId, // String da sequência de cores ML
        timestampGerado: agora,
        coresOrigemSinal: [...coresGatilho],
        ehMartingale: ehMartingaleIntent // Define se este sinal é uma tentativa de Martingale
    };
    ultimosGatilhosProcessados[gatilhoId] = agora; // Atualiza cooldown para este gatilho

    // Se um Martingale foi definido com sucesso, limpamos a flag de "necessidade de Martingale"
    if (ehMartingaleIntent) {
        sinalOriginalParaMartingale = null;
    }

    const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
    let msgDisplay, textColor;
    const nomeSinal = "OPORTUNIDADE ENCONTRADA"; // Novo nome

    if (ultimoSinal.ehMartingale) {
        msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--secondary-color)";
    } else {
        msgDisplay = `🎯 ${nomeSinal}\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--accent-color)";
    }

    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgDisplay.replace(/\n/g, '<br>');
        sinalTextoP.style.color = textColor;
        const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
        if(placeholderDiv) placeholderDiv.remove();
    }
    updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
    return true;
}


function verificarResultadoSinal(novaCorRegistrada) {
    // Só processa se houver um sinal ativo (seja normal ou Martingale já definido)
    if (!ultimoSinal.sinalEsperado) {
        // Se `sinalOriginalParaMartingale` existe, significa que um sinal normal falhou,
        // e estamos esperando o `mainLoop` tentar gerar o sinal de Martingale.
        // Não fazemos nada aqui, `mainLoop` cuidará de chamar `definirSinalAtivo` para o Martingale.
        return;
    }

    const sinalResolvido = { ...ultimoSinal }; // Copia o sinal que estava ativo
    let msgResultado = "", resultadoCorTexto = "var(--accent-color)";
    let cicloGanho = false; // Indica se o ciclo (sinal ou sinal+MG) foi ganho

    if (novaCorRegistrada === 'verde') {
        cicloGanho = true; // Verde sempre ganha o ciclo
        greenWins++; // Conta como uma vitória verde separada
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO (VERDE)! 🎰" : "🎯 VITÓRIA NO VERDE! 🎰";
        if(sinalResolvido.ehMartingale) martingaleWins++;
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        cicloGanho = true;
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        if(sinalResolvido.ehMartingale) martingaleWins++;
        resultadoCorTexto = "var(--success-color)";
    } else { // Perdeu a cor esperada
        if (sinalResolvido.ehMartingale) { // Estava em Martingale e perdeu
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            // `losses` será incrementado abaixo, pois o ciclo encerrou com perda
            resultadoCorTexto = "var(--danger-color)";
        } else { // Era um sinal normal e perdeu -> Ativa intenção de Martingale
            console.log(`Falha no sinal normal (${sinalResolvido.sinalEsperado}). Preparando para Martingale 1...`);
            sinalOriginalParaMartingale = { ...sinalResolvido }; // Guarda o sinal que falhou
            // Limpa o sinal ativo atual, o Martingale será definido no próximo ciclo do mainLoop se possível
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            // Não exibe mensagem de erro ainda, nem contabiliza perda. Espera o Martingale.
            // Não exibe "Aguardando Martingale" aqui, pois mainLoop tentará definir o Martingale imediatamente.
            return; // Retorna para mainLoop tentar o Martingale. O ciclo não encerrou.
        }
    }

    // Contabiliza vitória ou derrota do CICLO
    if (cicloGanho) {
        wins++;
    } else { // Perdeu no Martingale ou era um sinal sem Martingale que perdeu (lógica de Martingale não ativada)
        losses++;
    }

    // Exibe resultado e limpa estado
    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoP.style.color = resultadoCorTexto;
    }
    updateStatus(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0]}`, false, cicloGanho);

    setTimeout(() => {
        if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal.sinalEsperado) {
             sinalTextoP.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
             sinalTextoP.style.color = "var(--gray-color)";
        }
    }, 7000);

    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: sinalResolvido.gatilhoPadrao,
        coresQueFormaramGatilho: sinalResolvido.coresOrigemSinal ? [...sinalResolvido.coresOrigemSinal] : null,
        timestampResolvido: Date.now()
    };
    ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
    sinalOriginalParaMartingale = null; // Ciclo encerrado, limpa intenção de Martingale
    atualizarEstatisticasDisplay();
}


function atualizarEstatisticasDisplay() {
    if (winsSpan) winsSpan.textContent = wins;
    if (greenWinsSpan) greenWinsSpan.textContent = greenWins;
    if (lossesSpan) lossesSpan.textContent = losses;
    localStorage.setItem('roletaWins', wins.toString());
    localStorage.setItem('roletaLosses', losses.toString());
    localStorage.setItem('roletaGreenWins', greenWins.toString());
    localStorage.setItem('roletaMartingaleWins', martingaleWins.toString());
    const totalCiclos = wins + losses; // Cada win/loss representa um ciclo completo.
    const winRate = (totalCiclos > 0) ? (wins / totalCiclos * 100) : 0;
    if (winRateSpan) winRateSpan.textContent = winRate.toFixed(2) + "%";
}

function exibirCoresApi(cores) { /* console.log("Cores API (Onix):", cores); */ }

async function mainLoop() {
    const coresRecebidasDaAPI = await obterCoresAPI();

    if (coresRecebidasDaAPI && coresRecebidasDaAPI.length > 0) {
        if (typeof tf !== 'undefined' && model) {
             await trainModelTF(coresRecebidasDaAPI);
        }

        const dadosMudaram = (JSON.stringify(coresRecebidasDaAPI) !== JSON.stringify(ultimosRegistradosAPI));
        if (dadosMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresRecebidasDaAPI];
        }

        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale) {
             updateStatus("API OK (Onix). Monitorando...", false, true);
        }

        // 1. Resolver sinal ativo, se houver e os dados mudaram
        if (ultimoSinal.sinalEsperado && dadosMudaram) { // Só resolve se um sinal *estiver ativo*
            verificarResultadoSinal(ultimosRegistradosAPI[0]);
        }

        // 2. Tentar gerar um novo sinal (normal ou de Martingale)
        // Só tenta se não houver um sinal já ativo E (ou estamos iniciando OU os dados mudaram para evitar reprocessar o mesmo estado)
        if (!ultimoSinal.sinalEsperado && (dadosMudaram || ultimosRegistradosAPI.length === MAX_CORES_API )) { // MAX_CORES_API usado para o primeiro preenchimento
            if (sinalOriginalParaMartingale) { // Tentativa de Martingale
                // Para o Martingale, o SINAL é a MESMA COR do sinal que falhou.
                // O GATILHO pode ser a mesma sequência de cores que levou à falha.
                const corMartingale = sinalOriginalParaMartingale.sinalEsperado;
                const gatilhoOriginal = sinalOriginalParaMartingale.gatilhoPadrao; // string da sequência
                const coresOriginais = sinalOriginalParaMartingale.coresOrigemSinal; // array de cores

                console.log(`Tentando definir Martingale para: ${corMartingale.toUpperCase()}`);
                definirSinalAtivo(corMartingale, gatilhoOriginal, coresOriginais, true);
                // `sinalOriginalParaMartingale` será limpo dentro de `definirSinalAtivo` se o Martingale for setado.

            } else { // Tentativa de sinal normal
                if (typeof tf !== 'undefined' && model) {
                    const [sinalML, gatilhoMLStr, coresMLArr] = await verificarSinalComML(ultimosRegistradosAPI);
                    if (sinalML) {
                        definirSinalAtivo(sinalML, gatilhoMLStr, coresMLArr, false);
                    }
                }
            }
        }
    }

    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
        console.info(`--- Estatísticas (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${wins}, Verdes: ${greenWins}, MG Wins: ${martingaleWins}, Erros: ${losses}`);
        const total = wins + losses; const taxa = total > 0 ? (wins / total * 100).toFixed(2) : "0.00";
        console.info(`Assertividade: ${taxa}%`); console.info(`---`);
        lastStatsLogTime = agora;
    }
}

function zerarEstatisticas() {
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas?")) {
        wins = 0; losses = 0; greenWins = 0; martingaleWins = 0;
        sinalOriginalParaMartingale = null;
        ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
        ultimosGatilhosProcessados = {};
        ultimoSinalResolvidoInfo = { gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0 };
        localStorage.removeItem('roletaWins'); localStorage.removeItem('roletaLosses');
        localStorage.removeItem('roletaGreenWins'); localStorage.removeItem('roletaMartingaleWins');
        atualizarEstatisticasDisplay();
        if (sinalTextoP) {
            sinalTextoP.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
            sinalTextoP.style.color = "var(--gray-color)";
        }
        console.warn("ESTATÍSTICAS ZERADAS!"); updateStatus("Estatísticas zeradas.", false, false);
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    if (sinalTextoP && !sinalTextoP.textContent.includes("OPORTUNIDADE") && !sinalTextoP.textContent.includes("MARTINGALE")) {
        sinalTextoP.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
        sinalTextoP.style.color = "var(--gray-color)";
    }
    if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i>';
        statusDiv.title = "Bot Roleta (Onix API + TF.js) Iniciado.";
        statusDiv.style.color = 'dodgerblue';
    }
    console.log("Bot Roleta (Onix API + TF.js) Iniciado.");

    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js (tf) não carregado! Funcionalidade de ML desabilitada.");
        updateStatus("Erro: TensorFlow.js não carregado!", true);
    } else {
        model = createModelTF();
    }

    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now();
    mainLoop();
    setInterval(mainLoop, CHECK_INTERVAL);

    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas();
            if (casinoIframe) {
                const currentSrc = casinoIframe.src; casinoIframe.src = 'about:blank';
                setTimeout(() => { casinoIframe.src = currentSrc; }, 100);
                updateStatus("Iframe atualizado, estatísticas zeradas.", false, false);
            }
        });
    }
});

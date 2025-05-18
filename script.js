// script.js (Frontend com TensorFlow.js para API Onix)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 6000; // Aumentado um pouco para dar tempo ao TF.js
const MAX_CORES_API = 20;    // Usaremos os 20 da API Onix
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações e Variáveis Globais ---
let model;
const SEQUENCE_LENGTH = 5; // Usar as últimas 5 cores para prever a próxima
const NUM_FEATURES_PER_COLOR = 2; // Para one-hot encoding (Vermelho=[1,0], Preto=[0,1])
const NUM_CLASSES = 2; // Prever Vermelho ou Preto
let isTraining = false;
const ML_CONFIDENCE_THRESHOLD = 0.65; // Confiança mínima para sinal da ML

// Mapeamento de cores (simplificado para V/P na ML)
const COLOR_TO_INDEX_ML = { 'vermelho': 0, 'preto': 1 }; // Usado para labels Y
const INDEX_TO_COLOR_ML = { 0: 'vermelho', 1: 'preto' }; // Usado para interpretar predição

// --- Global State (Original) ---
let ultimosRegistradosAPI = []; // Os últimos 20 da API, após `identificarCor`
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,        // String do gatilho (padrão ML ou padrão fixo JSON)
    timestampGerado: null,
    coresOrigemSinal: null,     // Array das cores que formaram o gatilho
    ehMartingale: false
};
let sinalOriginalParaMartingale = null;
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
        const sequencia = historicoCores.slice(i + 1, i + 1 + SEQUENCE_LENGTH).reverse(); // Antigo->Novo
        const resultado = historicoCores[i]; // O que veio depois

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
    newModel.add(tf.layers.dense({
        inputShape: [SEQUENCE_LENGTH * NUM_FEATURES_PER_COLOR],
        units: 16,
        activation: 'relu'
    }));
    newModel.add(tf.layers.dropout({ rate: 0.3 })); // Aumentado dropout rate
    newModel.add(tf.layers.dense({
        units: NUM_CLASSES,
        activation: 'softmax'
    }));
    newModel.compile({
        optimizer: tf.train.adam(0.005), // Aumentada learning rate
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });
    console.log("Modelo TensorFlow.js criado.");
    return newModel;
}

async function trainModelTF(historicoCores) {
    if (isTraining || typeof tf === 'undefined' || !model) return;
    if (!historicoCores || historicoCores.length < SEQUENCE_LENGTH + 1) return;

    const { xs, ys } = prepareTrainingData(historicoCores);
    if (!xs || xs.shape[0] === 0) {
        if(xs) xs.dispose();
        if(ys) ys.dispose();
        return;
    }

    isTraining = true;
    // console.log(`Iniciando treinamento TF.js com ${xs.shape[0]} amostras.`);
    try {
        await model.fit(xs, ys, {
            epochs: 15, // Ajustado
            batchSize: Math.max(1, Math.floor(xs.shape[0] / 2) || 1), // Garante batchSize >= 1
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    // if ((epoch + 1) % 5 === 0) console.log(`Época TF.js ${epoch + 1}: perda=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
                }
            }
        });
        // console.log("Treinamento TF.js concluído.");
    } catch (error) {
        console.error("Erro durante o treinamento TF.js:", error);
    } finally {
        isTraining = false;
        xs.dispose();
        ys.dispose();
    }
}

async function verificarSinalComML(coresRecentes) { // Recebe os últimos 20 já processados
    if (typeof tf === 'undefined' || !model || !coresRecentes || coresRecentes.length < SEQUENCE_LENGTH) {
        return [null, null, null];
    }

    const sequenciaParaPrever = coresRecentes.slice(0, SEQUENCE_LENGTH).reverse(); // Antigo->Novo
    if (sequenciaParaPrever.includes('verde')) return [null, null, null];

    let inputTensor;
    try {
        inputTensor = colorsToInputTensor(sequenciaParaPrever);
        const prediction = model.predict(inputTensor);
        const predictionData = await prediction.data();
        tf.dispose(prediction); // Limpar tensor de predição

        const probVermelho = predictionData[0];
        const probPreto = predictionData[1];
        
        let sinalGerado = null;
        if (probVermelho > probPreto && probVermelho >= ML_CONFIDENCE_THRESHOLD) sinalGerado = 'vermelho';
        else if (probPreto > probVermelho && probPreto >= ML_CONFIDENCE_THRESHOLD) sinalGerado = 'preto';

        if (sinalGerado) {
            const confianca = Math.max(probVermelho, probPreto);
            console.info(`SINAL ML: ${sinalGerado.toUpperCase()} (Conf: ${(confianca * 100).toFixed(1)}%) | Gatilho: [${sequenciaParaPrever.join(',')}] (Antigo->Novo)`);
            const coresGatilhoApiOrder = [...sequenciaParaPrever].reverse(); // Novo->Antigo
            return [sinalGerado, coresGatilhoApiOrder.join(','), coresGatilhoApiOrder];
        }
    } catch (error) {
        console.error("Erro na previsão com ML:", error);
    } finally {
        if (inputTensor) inputTensor.dispose();
    }
    return [null, null, null];
}

// --- Funções Originais Adaptadas ---
function updateStatus(message, isError = false, isSuccess = false) {
    if (statusDiv) {
        let iconClass = 'fa-info-circle';
        let color = 'dodgerblue';
        let titleMessage = `Info: ${message}`;
        if (isError) { iconClass = 'fa-times-circle'; color = 'crimson'; titleMessage = `Erro: ${message}`; }
        else if (isSuccess) { iconClass = 'fa-check-circle'; color = 'green'; titleMessage = `Status: ${message}`; }
        statusDiv.innerHTML = `<i class="fas ${iconClass}"></i>`;
        statusDiv.style.color = color;
        statusDiv.title = titleMessage;
    }
    if (isError) console.error(message);
    // else console.log(message); 
}

async function obterCoresAPI() {
    // console.log("Buscando dados da API via Worker (Onix)...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(API_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorBody = "Erro Worker."; try { errorBody = await response.text(); } catch (e) {}
            updateStatus(`Erro HTTP ${response.status} (Onix): ${response.statusText}`, true);
            console.error("Erro Worker (Onix):", errorBody.substring(0, 200));
            return null;
        }
        const dados = await response.json();
        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                if (typeof identificarCor !== 'function') { // VERIFICAÇÃO IMPORTANTE
                    console.error("Função `identificarCor` não está definida! Verifique `cores_roleta.js`.");
                    updateStatus("Erro: `identificarCor` não definida.", true);
                    return null;
                }
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida (Onix).", true); return null;
                }
                return coresValidas;
            }
        }
        updateStatus("Dados API (Onix) formato inesperado.", true); return null;
    } catch (error) {
        if (error.name === 'AbortError') updateStatus("Timeout API (Onix).", true);
        else updateStatus(`ERRO FETCH (Onix): ${error.message}`, true);
        console.error("Erro fetch (Onix):", error); return null;
    }
}

// Função para processar o sinal detectado (seja da ML ou de Padrões Fixos no futuro)
function processarSinalDetectado(sinalDetectado, gatilhoIdentificador, coresGatilhoArray, forcarMartingale = false) {
    if (!sinalDetectado) return false;

    const agora = Date.now();
    // gatilhoIdentificador é uma string (seja da ML "V,P,V" ou JSON.stringify de array de padrão fixo)

    if (!forcarMartingale) {
        if (ultimosGatilhosProcessados[gatilhoIdentificador] && (agora - ultimosGatilhosProcessados[gatilhoIdentificador] < SIGNAL_COOLDOWN)) {
            // console.log(`Cooldown para gatilho "${gatilhoIdentificador}" ativo. Sinal ignorado.`);
            return false;
        }
        const foiResolvidoRecentementeComMesmoGatilhoECores =
            (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
            ultimoSinalResolvidoInfo.gatilhoPadrao === gatilhoIdentificador &&
            JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresGatilhoArray);

        if (foiResolvidoRecentementeComMesmoGatilhoECores) {
            // console.log("Gatilho idêntico resolvido recentemente. Sinal ignorado.");
            return false;
        }
    }

    ultimoSinal = {
        sinalEsperado: sinalDetectado,
        gatilhoPadrao: gatilhoIdentificador,
        timestampGerado: agora,
        coresOrigemSinal: [...coresGatilhoArray],
        ehMartingale: forcarMartingale
    };
    ultimosGatilhosProcessados[gatilhoIdentificador] = agora;

    if (forcarMartingale) sinalOriginalParaMartingale = null;

    const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
    let msgDisplay, textColor;
    const origemSinal = gatilhoIdentificador.includes(',') ? "ML" : "FIXO"; // Identifica origem pela vírgula

    if (ultimoSinal.ehMartingale) {
        msgDisplay = `🔄 MARTINGALE 1 (${origemSinal})\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--secondary-color)";
    } else {
        msgDisplay = `🎯 SINAL ${origemSinal}\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--accent-color)";
    }

    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgDisplay.replace(/\n/g, '<br>');
        sinalTextoP.style.color = textColor;
        const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
        if(placeholderDiv) placeholderDiv.remove();
    }
    updateStatus(`Sinal ${origemSinal}: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
    return true;
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale) return;

    if (sinalOriginalParaMartingale) {
        // Tentar gerar Martingale (esta lógica assume que `processarSinalDetectado` é chamado após uma análise)
        // Para simplificar, o Martingale usará a mesma fonte de sinal que o original.
        // Se o original foi ML, Martingale tentará ML. Se foi Fixo, tentará Fixo.
        // Por agora, a lógica de Martingale não re-analisa, ela apenas inverte ou repete o sinal.
        // A chamada a `gerenciarSinais` no seu código original era para re-verificar padrões.
        // Vamos manter a tentativa de re-verificar, mas pode ser que não ache padrão para Martingale.
        let sinalMartingaleGerado = false;
        if (typeof tf !== 'undefined' && model && ultimosRegistradosAPI.length >= SEQUENCE_LENGTH) {
            // Tenta gerar sinal de Martingale com ML.
            // A lógica de "forcarMartingale=true" em processarSinalDetectado lida com o estado.
            // Aqui precisamos decidir QUAL SINAL o Martingale deveria ser.
            // Por simplicidade, o Martingale vai usar o mesmo sinal que falhou (ou o oposto, dependendo da estratégia).
            // Este exemplo NÃO implementa uma estratégia de Martingale inteligente baseada em nova análise.
            // Ele apenas define o estado de Martingale. A lógica de `processarSinalDetectado`
            // será chamada no próximo ciclo de `mainLoop` se um sinal for detectado.
            
            // A lógica original chamava `gerenciarSinais(ultimosRegistradosAPI, true)`
            // que por sua vez chamava `verificarPadrao`.
            // Vamos simular isso:
            // const [sinalMG, gatilhoMG, coresMG] = await verificarSinalComML(ultimosRegistradosAPI); // Se for ML
            // if(sinalMG) { sinalMartingaleGerado = processarSinalDetectado(sinalMG, gatilhoMG, coresMG, true); }
            // Por ora, a flag `sinalOriginalParaMartingale` é o principal. O próximo sinal detectado será Martingale.
            // Se nenhum padrão/sinal for encontrado no próximo `mainLoop` para o Martingale, ele fica aguardando.
             if (sinalTextoP && !sinalTextoP.innerHTML.includes("MARTINGALE")) {
                 sinalTextoP.innerHTML = `⏳ Aguardando Martingale 1...`;
                 sinalTextoP.style.color = "var(--warning-color)";
            }
            // A lógica de `mainLoop` tentará gerar um sinal que, se encontrado, será processado como Martingale.
            return; // Sai para esperar o próximo ciclo do mainLoop tentar gerar o sinal de Martingale
        }
         return; // Se ML não está pronta, apenas espera.
    }

    const sinalResolvido = { ...ultimoSinal };
    let msgResultado = "", resultadoCorTexto = "var(--accent-color)", cicloEncerrado = true;

    if (novaCorRegistrada === 'verde') {
        wins++; greenWins++;
        msgResultado = sinalResolvido.ehMartingale ? (martingaleWins++, "🎯 MARTINGALE GANHO (VERDE)! 🎰") : "🎯 VITÓRIA NO VERDE! 🎰";
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        wins++;
        msgResultado = sinalResolvido.ehMartingale ? (martingaleWins++, "🎯 MARTINGALE GANHO! ✅") : "🎯 ACERTO! ✅";
        resultadoCorTexto = "var(--success-color)";
    } else {
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎"; losses++;
            resultadoCorTexto = "var(--danger-color)";
        } else {
            sinalOriginalParaMartingale = { ...sinalResolvido };
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            cicloEncerrado = false;
            // console.log(`Falha no sinal (${sinalOriginalParaMartingale.sinalEsperado}). Tentando Martingale 1...`);
            // O mainLoop tentará gerar um novo sinal que será marcado como Martingale por processarSinalDetectado
            // se sinalOriginalParaMartingale estiver setado.
            // A chamada a `processarSinalDetectado` com `forcarMartingale=true` deve ser feita
            // se um sinal for encontrado enquanto `sinalOriginalParaMartingale` está ativo.
            // No `mainLoop`, se `sinalOriginalParaMartingale` existe, e um novo sinal é detectado,
            // `processarSinalDetectado` será chamado com `forcarMartingale = true`.
             if (sinalTextoP) {
                sinalTextoP.innerHTML = `⏳ Aguardando Martingale 1...`;
                sinalTextoP.style.color = "var(--warning-color)";
            }
            return; // Retorna para `mainLoop` tentar gerar o sinal de Martingale
        }
    }

    if (cicloEncerrado) {
        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
            sinalTextoP.style.color = resultadoCorTexto;
        }
        updateStatus(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0]}`, false, resultadoCorTexto === "var(--success-color)" || resultadoCorTexto === "var(--green-color)");

        setTimeout(() => {
            const placeholderAtivo = sinalTextoP && sinalTextoP.querySelector('.signal-placeholder');
            if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal.sinalEsperado && !placeholderAtivo ) {
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
        sinalOriginalParaMartingale = null;
        atualizarEstatisticasDisplay();
    }
}

function atualizarEstatisticasDisplay() {
    if (winsSpan) winsSpan.textContent = wins;
    if (greenWinsSpan) greenWinsSpan.textContent = greenWins;
    if (lossesSpan) lossesSpan.textContent = losses;
    localStorage.setItem('roletaWins', wins.toString());
    localStorage.setItem('roletaLosses', losses.toString());
    localStorage.setItem('roletaGreenWins', greenWins.toString());
    localStorage.setItem('roletaMartingaleWins', martingaleWins.toString());
    const totalSinais = wins + losses;
    const winRate = (totalSinais > 0) ? (wins / totalSinais * 100) : 0;
    if (winRateSpan) winRateSpan.textContent = winRate.toFixed(2) + "%";
}

function exibirCoresApi(cores) { /* console.log("Cores API (Onix):", cores); */ }

async function mainLoop() {
    const coresRecebidasDaAPI = await obterCoresAPI();

    if (coresRecebidasDaAPI && coresRecebidasDaAPI.length > 0) {
        // Treinar o modelo com os dados mais recentes
        if (typeof tf !== 'undefined' && model) { // Garante que tf e model existem
             await trainModelTF(coresRecebidasDaAPI);
        }

        const dadosMudaram = (JSON.stringify(coresRecebidasDaAPI) !== JSON.stringify(ultimosRegistradosAPI));
        if (dadosMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresRecebidasDaAPI]; // Atualiza nosso "último conhecido"
        }

        // exibirCoresApi(ultimosRegistradosAPI); // Mostra os 20 da API já processados
        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !sinalOriginalParaMartingale && !ultimoSinal.sinalEsperado) {
             updateStatus("API OK (Onix). Monitorando...", false, true);
        }

        // Verificar resultado de sinal ativo
        if ((ultimoSinal.sinalEsperado || sinalOriginalParaMartingale) && dadosMudaram) {
            verificarResultadoSinal(ultimosRegistradosAPI[0]); // Usa a cor mais recente
        }
        
        // Tentar gerar um novo sinal (normal ou de Martingale)
        if (!ultimoSinal.sinalEsperado) { // Só tenta gerar se não houver sinal ativo
            let sinalGerado = null, gatilhoDoSinal = null, coresDoGatilho = null;

            if (typeof tf !== 'undefined' && model) { // Tenta com ML
                const [sinalML, gatilhoMLStr, coresMLArr] = await verificarSinalComML(ultimosRegistradosAPI);
                if (sinalML) {
                    sinalGerado = sinalML; gatilhoDoSinal = gatilhoMLStr; coresDoGatilho = coresMLArr;
                }
            }
            
            // OPCIONAL: Fallback para padrões fixos se ML não der sinal e PADROES estiver definido
            if (!sinalGerado && typeof PADROES !== 'undefined' && typeof verificarPadrao === 'function') {
                // console.log("ML não gerou sinal ou não está pronta, tentando padrões fixos...");
                const [sinalFixo, gatilhoFixoArr, coresFixoArr] = verificarPadrao(ultimosRegistradosAPI);
                if (sinalFixo) {
                    sinalGerado = sinalFixo; gatilhoDoSinal = JSON.stringify(gatilhoFixoArr); coresDoGatilho = coresFixoArr;
                }
            }

            if (sinalGerado) {
                // Se `sinalOriginalParaMartingale` está setado, este novo sinal é uma tentativa de Martingale.
                processarSinalDetectado(sinalGerado, gatilhoDoSinal, coresDoGatilho, !!sinalOriginalParaMartingale);
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
    if (sinalTextoP && !sinalTextoP.textContent.includes("SINAL") && !sinalTextoP.textContent.includes("MARTINGALE")) {
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
        model = createModelTF(); // Cria o modelo
    }

    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now();
    mainLoop(); // Primeira chamada
    setInterval(mainLoop, CHECK_INTERVAL);

    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas();
            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                const currentSrc = casinoIframe.src;
                casinoIframe.src = 'about:blank';
                setTimeout(() => { casinoIframe.src = currentSrc; }, 100);
                updateStatus("Iframe atualizado, estatísticas zeradas.", false, false);
            }
        });
    }
});

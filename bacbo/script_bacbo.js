// script_bacbo.js (Adaptado para Bac Bo com TF.js, 1 Martingale, e TODOS os resultados da API)

// --- Configuration ---
const TARGET_API_URL_BACBO = 'https://onixapis.com:2083/public/api/evolution/bacbo-ao-vivo';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL_BACBO)}`;

const API_TIMEOUT = 20000; // Aumentar um pouco se a resposta for grande
const CHECK_INTERVAL = 7000; // Aumentar se o processamento de mais dados demorar
// const MAX_RESULTADOS_API = 20; // REMOVIDO - Usaremos todos os resultados fornecidos
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações ---
let modelBacBo;
const SEQUENCE_LENGTH_BACBO = 5; // Pode até aumentar um pouco se tiver mais dados, ex: 7 ou 10
const NUM_FEATURES_PER_RESULT_BACBO = 2;
const NUM_CLASSES_BACBO = 2;
let isTrainingBacBo = false;
const ML_CONFIDENCE_THRESHOLD_BACBO = 0.60;

const RESULTADO_TO_INDEX_ML_BACBO = { [PLAYER_WIN]: 0, [BANKER_WIN]: 1 };
const INDEX_TO_RESULTADO_ML_BACBO = { 0: PLAYER_WIN, 1: BANKER_WIN };

// --- Global State ---
let ultimosResultadosApiBacBo = []; // Armazenará TODOS os resultados processados da API
let ultimoSinalBacBo = {
    sinalEsperado: null,
    gatilhoPadrao: null,
    timestampGerado: null,
    coresOrigemSinal: null, // (resultadosOrigemSinal)
    ehMartingale: false
};
let sinalOriginalParaMartingaleBacBo = null;
let ultimosGatilhosProcessadosBacBo = {};
let ultimoSinalResolvidoInfoBacBo = {
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null, // (resultadosQueFormaramGatilho)
    timestampResolvido: 0
};

let winsBacBo = parseInt(localStorage.getItem('bacboWins')) || 0;
let lossesBacBo = parseInt(localStorage.getItem('bacboLosses')) || 0;
let tieResultsBacBo = parseInt(localStorage.getItem('bacboTieResults')) || 0;
let martingaleWinsBacBo = parseInt(localStorage.getItem('bacboMartingaleWins')) || 0;
let lastStatsLogTimeBacBo = Date.now();

// --- DOM Elements Cache (mesmo de antes) ---
const statusDivBacBo = document.getElementById('status');
const sinalTextoPBacBo = document.getElementById('sinal-texto');
const winsSpanBacBo = document.getElementById('wins');
const tieResultsSpanBacBo = document.getElementById('tie-results');
const lossesSpanBacBo = document.getElementById('losses');
const winRateSpanBacBo = document.getElementById('win-rate');

// --- Funções Auxiliares de ML para BacBo (mesmas de antes) ---
function resultadosToInputTensorBacBo(resultadoSequence) {
    const tensorData = [];
    for (const resultado of resultadoSequence) {
        if (resultado === PLAYER_WIN) tensorData.push(1, 0);
        else if (resultado === BANKER_WIN) tensorData.push(0, 1);
        else tensorData.push(0.5, 0.5);
    }
    // Certifique-se de que SEQUENCE_LENGTH_BACBO está correto aqui
    return tf.tensor2d([tensorData], [1, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]);
}

function prepareTrainingDataBacBo(historicoResultados) {
    const xs_data = []; const ys_data = [];
    if (!historicoResultados || historicoResultados.length < SEQUENCE_LENGTH_BACBO + 1) return { xs: null, ys: null };

    for (let i = 0; i <= historicoResultados.length - (SEQUENCE_LENGTH_BACBO + 1); i++) {
        const sequencia = historicoResultados.slice(i + 1, i + 1 + SEQUENCE_LENGTH_BACBO).reverse();
        const resultadoReal = historicoResultados[i];
        if ((resultadoReal === PLAYER_WIN || resultadoReal === BANKER_WIN) && !sequencia.includes(TIE_RESULT)) {
            const inputFeatures = [];
            for (const res of sequencia) {
                if (res === PLAYER_WIN) inputFeatures.push(1, 0);
                else if (res === BANKER_WIN) inputFeatures.push(0, 1);
            }
            xs_data.push(inputFeatures);
            ys_data.push(RESULTADO_TO_INDEX_ML_BACBO[resultadoReal]);
        }
    }
    if (xs_data.length === 0) return { xs: null, ys: null };
    const xTensor = tf.tensor2d(xs_data, [xs_data.length, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]);
    const yTensor = tf.oneHot(tf.tensor1d(ys_data, 'int32'), NUM_CLASSES_BACBO);
    return { xs: xTensor, ys: yTensor };
}

function createModelTFBacBo() {
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ inputShape: [SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO], units: 32, activation: 'relu' })); // Aumentar units um pouco com mais dados
    newModel.add(tf.layers.dropout({ rate: 0.3 })); // Pode aumentar um pouco o dropout
    newModel.add(tf.layers.dense({ units: NUM_CLASSES_BACBO, activation: 'softmax' }));
    newModel.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] }); // Learning rate pode ser menor com mais dados
    console.log("Modelo TensorFlow.js para Bac Bo criado.");
    return newModel;
}

async function trainModelTFBacBo(historicoResultados) {
    if (isTrainingBacBo || typeof tf === 'undefined' || !modelBacBo) return;
    if (!historicoResultados || historicoResultados.length < SEQUENCE_LENGTH_BACBO + 1) return;
    
    const { xs, ys } = prepareTrainingDataBacBo(historicoResultados);
    if (!xs || xs.shape[0] === 0) { if(xs) xs.dispose(); if(ys) ys.dispose(); return; }
    
    isTrainingBacBo = true;
    // console.log(`Iniciando treinamento TF.js BacBo com ${xs.shape[0]} amostras.`);
    try {
        // Com mais dados, podemos aumentar um pouco as épocas ou ajustar o batchSize
        const batchSize = Math.max(8, Math.floor(xs.shape[0] / 10) || 8); // Exemplo de ajuste de batchSize
        await modelBacBo.fit(xs, ys, {
            epochs: 15, // Pode aumentar para 15-25 com mais dados
            batchSize: batchSize, 
            shuffle: true,
            callbacks: { onEpochEnd: (epoch, logs) => { /* Log de treino */ } }
        });
        // console.log("Treinamento TF.js BacBo concluído.");
    } catch (error) { console.error("Erro Treinamento TF.js BacBo:", error); }
    finally { isTrainingBacBo = false; xs.dispose(); ys.dispose(); }
}

async function verificarSinalComMLBacBo(resultadosRecentes) {
    if (typeof tf === 'undefined' || !modelBacBo || !resultadosRecentes || resultadosRecentes.length < SEQUENCE_LENGTH_BACBO) return [null, null, null];
    // Usa apenas os SEQUENCE_LENGTH_BACBO mais recentes para a previsão, mesmo que tenhamos mais no histórico
    const sequenciaParaPrever = resultadosRecentes.slice(0, SEQUENCE_LENGTH_BACBO).reverse(); 
    if (sequenciaParaPrever.includes(TIE_RESULT)) return [null, null, null];

    let inputTensor;
    try {
        inputTensor = resultadosToInputTensorBacBo(sequenciaParaPrever);
        const prediction = modelBacBo.predict(inputTensor);
        const predictionData = await prediction.data();
        tf.dispose(prediction);
        const probPlayer = predictionData[0]; const probBanker = predictionData[1];
        let sinalGerado = null;

        if (probPlayer > probBanker && probPlayer >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = PLAYER_WIN;
        else if (probBanker > probPlayer && probBanker >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = BANKER_WIN;

        if (sinalGerado) {
            const confianca = Math.max(probPlayer, probBanker);
            // console.info(`SINAL ML BACBO: ${sinalGerado} (Conf: ${(confianca * 100).toFixed(1)}%) | Gatilho: [${sequenciaParaPrever.join(',')}]`);
            const resultadosGatilhoApiOrder = [...sequenciaParaPrever].reverse();
            return [sinalGerado, resultadosGatilhoApiOrder.join(','), resultadosGatilhoApiOrder];
        }
    } catch (error) { console.error("Erro na previsão ML BacBo:", error); }
    finally { if (inputTensor) inputTensor.dispose(); }
    return [null, null, null];
}

// --- Funções Principais do Bot para BacBo ---
function updateStatusBacBo(message, isError = false, isSuccess = false) {
    // ... (mesma de antes)
    if (statusDivBacBo) {
        let iconClass = 'fa-info-circle'; let color = 'dodgerblue'; let titleMessage = `Info: ${message}`;
        if (isError) { iconClass = 'fa-times-circle'; color = 'crimson'; titleMessage = `Erro: ${message}`; }
        else if (isSuccess) { iconClass = 'fa-check-circle'; color = 'green'; titleMessage = `Status: ${message}`; }
        statusDivBacBo.innerHTML = `<i class="fas ${iconClass}"></i>`; statusDivBacBo.style.color = color; statusDivBacBo.title = titleMessage;
    }
    if (isError) console.error(message);
}

async function obterResultadosApiBacBo() {
    try {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(API_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) { updateStatusBacBo(`Erro HTTP ${response.status} (BacBo)`, true); return null; }
        const dados = await response.json();
        // Em script_bacbo.js
// const NOME_CHAVE_API_BACBO = "BacBo - Ao Vivo"; // LINHA ANTIGA E INCORRETA
const NOME_CHAVE_API_BACBO = "history";        // LINHA CORRIGIDA // <<< VERIFIQUE E AJUSTE ESTA CHAVE!!!
        
        if (dados && dados[NOME_CHAVE_API_BACBO] && Array.isArray(dados[NOME_CHAVE_API_BACBO])) {
            const resultadosCrus = dados[NOME_CHAVE_API_BACBO];
            if (resultadosCrus.length > 0) {
                if (typeof identificarResultadoBacBo !== 'function') { updateStatusBacBo("Erro: `identificarResultadoBacBo` não definida.", true); return null; }
                // MODIFICAÇÃO: Não usar mais .slice(0, MAX_RESULTADOS_API)
                const resultadosProcessados = resultadosCrus.map(identificarResultadoBacBo); 
                const resultadosValidos = resultadosProcessados.filter(r => r !== INVALID_RESULT);
                if (resultadosValidos.length === 0) { updateStatusBacBo("Nenhum resultado válido (BacBo).", true); return null; }
                console.log(`[BacBo API] Recebidos ${resultadosValidos.length} resultados válidos.`);
                return resultadosValidos; // Retorna todos os resultados válidos
            }
        }
        updateStatusBacBo(`Dados API (BacBo) formato inesperado. Esperando chave: ${NOME_CHAVE_API_BACBO}`, true); return null;
    } catch (error) {
        if (error.name === 'AbortError') updateStatusBacBo("Timeout API (BacBo).", true);
        else updateStatusBacBo(`ERRO FETCH (BacBo): ${error.message.substring(0,30)}`, true);
        console.error("Erro fetch (BacBo):", error); return null;
    }
}

// ... (definirSinalAtivoBacBo, verificarResultadoSinalBacBo, atualizarEstatisticasBacBo permanecem os mesmos da resposta anterior)
// COPIAR ESSAS FUNÇÕES DA RESPOSTA ANTERIOR ONDE ELAS FORAM DEFINIDAS COMPLETAMENTE.
// Por brevidade, não as repetirei aqui. Elas são:
// - definirSinalAtivoBacBo(resultadoSinal, gatilhoId, resultadosGatilho, ehMartingaleIntent)
// - verificarResultadoSinalBacBo(novoResultadoRegistrado)
// - atualizarEstatisticasBacBo()

// --- COPIE AS FUNÇÕES COMPLETAS DEFINIR_SINAL, VERIFICAR_RESULTADO, ATUALIZAR_STATS DA RESPOSTA ANTERIOR AQUI ---
// Função para definir e exibir um sinal (normal ou Martingale)
function definirSinalAtivoBacBo(resultadoSinal, gatilhoId, resultadosGatilho, ehMartingaleIntent) {
    if (!resultadoSinal) return false;
    const agora = Date.now();
    if (!ehMartingaleIntent) {
        if (ultimosGatilhosProcessadosBacBo[gatilhoId] && (agora - ultimosGatilhosProcessadosBacBo[gatilhoId] < SIGNAL_COOLDOWN)) return false;
        const foiResolvidoRecentemente = (agora - ultimoSinalResolvidoInfoBacBo.timestampResolvido < SIGNAL_COOLDOWN) &&
                                       ultimoSinalResolvidoInfoBacBo.gatilhoPadrao === gatilhoId &&
                                       JSON.stringify(ultimoSinalResolvidoInfoBacBo.coresQueFormaramGatilho) === JSON.stringify(resultadosGatilho);
        if (foiResolvidoRecentemente) return false;
    }

    ultimoSinalBacBo = {
        sinalEsperado: resultadoSinal,
        gatilhoPadrao: gatilhoId,
        timestampGerado: agora,
        coresOrigemSinal: [...resultadosGatilho],
        ehMartingale: ehMartingaleIntent
    };
    ultimosGatilhosProcessadosBacBo[gatilhoId] = agora;
    if (ehMartingaleIntent) sinalOriginalParaMartingaleBacBo = null;

    const sinalUpper = ultimoSinalBacBo.sinalEsperado.toUpperCase();
    let msgDisplay, textColor;
    const nomeSinal = "OPORTUNIDADE BACBO";

    if (ultimoSinalBacBo.ehMartingale) {
        msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--secondary-color)";
    } else {
        msgDisplay = `🎲 ${nomeSinal}\n➡️ Entrar no ${sinalUpper}`;
        textColor = "var(--accent-color)";
    }

    if (sinalTextoPBacBo) {
        sinalTextoPBacBo.innerHTML = msgDisplay.replace(/\n/g, '<br>');
        sinalTextoPBacBo.style.color = textColor;
        const placeholderDiv = sinalTextoPBacBo.querySelector('.signal-placeholder');
        if(placeholderDiv) placeholderDiv.remove();
    }
    updateStatusBacBo(`Sinal: ${sinalUpper}${ultimoSinalBacBo.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
    return true;
}

function verificarResultadoSinalBacBo(novoResultadoRegistrado) {
    if (!ultimoSinalBacBo.sinalEsperado) return;

    const sinalResolvido = { ...ultimoSinalBacBo };
    let msgResultado = "", resultadoCorTexto = "var(--accent-color)";
    let cicloGanho = false;

    if (novoResultadoRegistrado === TIE_RESULT) {
        tieResultsBacBo++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "⚠️ EMPATE NO MARTINGALE! Push.";
        } else {
            msgResultado = "⚠️ EMPATE! Push.";
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido }; 
            ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            if (sinalTextoPBacBo) {
                sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
                sinalTextoPBacBo.style.color = "var(--warning-color)";
            }
            atualizarEstatisticasBacBo();
            return; 
        }
        resultadoCorTexto = "var(--warning-color)";
    } else if (novoResultadoRegistrado === sinalResolvido.sinalEsperado) {
        cicloGanho = true;
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        if(sinalResolvido.ehMartingale) martingaleWinsBacBo++;
        resultadoCorTexto = "var(--success-color)";
    } else { 
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            resultadoCorTexto = "var(--danger-color)";
        } else {
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            return; 
        }
    }

    if (cicloGanho) winsBacBo++;
    else if (novoResultadoRegistrado !== TIE_RESULT) lossesBacBo++;

    if (sinalTextoPBacBo) {
        sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoPBacBo.style.color = resultadoCorTexto;
    }
    updateStatusBacBo(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0]}`, false, cicloGanho);

    setTimeout(() => {
        if (sinalTextoPBacBo && sinalTextoPBacBo.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinalBacBo.sinalEsperado) {
             sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
             sinalTextoPBacBo.style.color = "var(--gray-color)";
        }
    }, 7000);

    ultimoSinalResolvidoInfoBacBo = {
        gatilhoPadrao: sinalResolvido.gatilhoPadrao,
        coresQueFormaramGatilho: sinalResolvido.coresOrigemSinal ? [...sinalResolvido.coresOrigemSinal] : null,
        timestampResolvido: Date.now()
    };
    ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
    sinalOriginalParaMartingaleBacBo = null;
    atualizarEstatisticasBacBo();
}

function atualizarEstatisticasBacBo() {
    if (winsSpanBacBo) winsSpanBacBo.textContent = winsBacBo;
    if (tieResultsSpanBacBo) tieResultsSpanBacBo.textContent = tieResultsBacBo;
    if (lossesSpanBacBo) lossesSpanBacBo.textContent = lossesBacBo;
    localStorage.setItem('bacboWins', winsBacBo.toString());
    localStorage.setItem('bacboLosses', lossesBacBo.toString());
    localStorage.setItem('bacboTieResults', tieResultsBacBo.toString());
    localStorage.setItem('bacboMartingaleWins', martingaleWinsBacBo.toString());
    const totalCiclos = winsBacBo + lossesBacBo;
    const winRate = (totalCiclos > 0) ? (winsBacBo / totalCiclos * 100) : 0;
    if (winRateSpanBacBo) winRateSpanBacBo.textContent = winRate.toFixed(2) + "%";
}


async function mainLoopBacBo() {
    const resultadosRecebidosDaAPI = await obterResultadosApiBacBo();

    if (resultadosRecebidosDaAPI && resultadosRecebidosDaAPI.length > 0) {
        // console.log("Resultados API BacBo (todos):", resultadosRecebidosDaAPI.length, resultadosRecebidosDaAPI.slice(0,5));
        if (typeof tf !== 'undefined' && modelBacBo) {
             await trainModelTFBacBo(resultadosRecebidosDaAPI); // Treina com todos os resultados
        }
        const dadosMudaram = (JSON.stringify(resultadosRecebidosDaAPI) !== JSON.stringify(ultimosResultadosApiBacBo));
        if (dadosMudaram || ultimosResultadosApiBacBo.length === 0) {
            ultimosResultadosApiBacBo = [...resultadosRecebidosDaAPI]; // Atualiza com todos os resultados
        }

        if (statusDivBacBo && !statusDivBacBo.title.startsWith("Erro:") && !ultimoSinalBacBo.sinalEsperado && !sinalOriginalParaMartingaleBacBo) {
             updateStatusBacBo("API BacBo OK. Monitorando...", false, true);
        }

        if (ultimoSinalBacBo.sinalEsperado && dadosMudaram) {
            verificarResultadoSinalBacBo(ultimosResultadosApiBacBo[0]); // Verifica com o mais recente
        }

        // MODIFICAÇÃO: Só tenta gerar sinal se não houver sinal ativo E os dados mudaram (para não reprocessar o mesmo estado)
        // Ou se for a primeira vez que temos dados suficientes para predição.
        const podeGerarNovoSinal = ultimosResultadosApiBacBo.length >= SEQUENCE_LENGTH_BACBO;
        if (!ultimoSinalBacBo.sinalEsperado && (dadosMudaram || podeGerarNovoSinal) ) {
            if (sinalOriginalParaMartingaleBacBo) {
                const resultadoMartingale = sinalOriginalParaMartingaleBacBo.sinalEsperado;
                const gatilhoOriginal = sinalOriginalParaMartingaleBacBo.gatilhoPadrao;
                const resultadosOriginais = sinalOriginalParaMartingaleBacBo.coresOrigemSinal;
                // console.log(`Tentando definir Martingale BacBo para: ${resultadoMartingale.toUpperCase()}`);
                definirSinalAtivoBacBo(resultadoMartingale, gatilhoOriginal, resultadosOriginais, true);
            } else {
                if (typeof tf !== 'undefined' && modelBacBo && podeGerarNovoSinal) {
                    // Passa todos os resultados para `verificarSinalComMLBacBo`, 
                    // ela internamente pegará os mais recentes para a `SEQUENCE_LENGTH_BACBO`
                    const [sinalML, gatilhoMLStr, resultadosMLArr] = await verificarSinalComMLBacBo(ultimosResultadosApiBacBo);
                    if (sinalML) {
                        definirSinalAtivoBacBo(sinalML, gatilhoMLStr, resultadosMLArr, false);
                    }
                }
            }
        }
    }

    const agora = Date.now();
    if (agora - lastStatsLogTimeBacBo >= STATS_INTERVAL) {
        console.info(`--- Estatísticas BacBo (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${winsBacBo}, Empates: ${tieResultsBacBo}, MG Wins: ${martingaleWinsBacBo}, Erros: ${lossesBacBo}`);
        const total = winsBacBo + lossesBacBo; const taxa = total > 0 ? (winsBacBo / total * 100).toFixed(2) : "0.00";
        console.info(`Assertividade BacBo (P/B): ${taxa}%`); console.info(`---`);
        lastStatsLogTimeBacBo = agora;
    }
}

function zerarEstatisticasBacBo() {
    // ... (mesma de antes)
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas do Bac Bo?")) {
        winsBacBo = 0; lossesBacBo = 0; tieResultsBacBo = 0; martingaleWinsBacBo = 0;
        sinalOriginalParaMartingaleBacBo = null;
        ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
        ultimosGatilhosProcessadosBacBo = {};
        ultimoSinalResolvidoInfoBacBo = { gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0 };
        localStorage.removeItem('bacboWins'); localStorage.removeItem('bacboLosses');
        localStorage.removeItem('bacboTieResults'); localStorage.removeItem('bacboMartingaleWins');
        atualizarEstatisticasBacBo();
        if (sinalTextoPBacBo) {
            sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
            sinalTextoPBacBo.style.color = "var(--gray-color)";
        }
        console.warn("ESTATÍSTICAS BACBO ZERADAS!"); updateStatusBacBo("Estatísticas BacBo zeradas.", false, false);
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (mesma de antes, com nomes de variáveis/funções BacBo)
    if (sinalTextoPBacBo && !sinalTextoPBacBo.textContent.includes("OPORTUNIDADE") && !sinalTextoPBacBo.textContent.includes("MARTINGALE")) {
        sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
        sinalTextoPBacBo.style.color = "var(--gray-color)";
    }
    if (statusDivBacBo) {
        statusDivBacBo.innerHTML = '<i class="fas fa-info-circle"></i>';
        statusDivBacBo.title = "Bot BacBo (API + TF.js) Iniciado.";
        statusDivBacBo.style.color = 'dodgerblue';
    }
    console.log("Bot BacBo (API + TF.js) Iniciado.");

    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js (tf) não carregado! Funcionalidade de ML desabilitada.");
        updateStatusBacBo("Erro: TensorFlow.js não carregado!", true);
    } else {
        modelBacBo = createModelTFBacBo();
    }

    atualizarEstatisticasBacBo();
    lastStatsLogTimeBacBo = Date.now();
    mainLoopBacBo();
    setInterval(mainLoopBacBo, CHECK_INTERVAL);

    const refreshButton = document.getElementById('refresh-iframe');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            zerarEstatisticasBacBo();
            const iframe = document.getElementById('casino-iframe');
            if (iframe) {
                const currentSrc = iframe.src; iframe.src = 'about:blank';
                setTimeout(() => { iframe.src = currentSrc; }, 100);
                updateStatusBacBo("Iframe atualizado, estatísticas BacBo zeradas.", false, false);
            }
        });
    }
});

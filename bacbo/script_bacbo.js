// script_bacbo.js (COMPLETO E ATUALIZADO)

// --- Configuration ---
const TARGET_API_URL_BACBO = 'https://onixapis.com:2083/public/api/evolution/bacbo-ao-vivo';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL_BACBO)}`;

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 6000;
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações ---
let modelBacBo;
const SEQUENCE_LENGTH_BACBO = 5;
const NUM_FEATURES_PER_RESULT_BACBO = 2;
const NUM_CLASSES_BACBO = 2;
let isTrainingBacBo = false;
const ML_CONFIDENCE_THRESHOLD_BACBO = 0.58;

// Constantes PLAYER_WIN, BANKER_WIN, TIE_RESULT, INVALID_RESULT são definidas em resultados_bacbo.js
// e devem estar globalmente acessíveis aqui.
const RESULTADO_TO_INDEX_ML_BACBO = { [PLAYER_WIN]: 0, [BANKER_WIN]: 1 };
const INDEX_TO_RESULTADO_ML_BACBO = { 0: PLAYER_WIN, 1: BANKER_WIN };

// --- Global State ---
let ultimosResultadosApiBacBo = [];
let ultimoSinalBacBo = {
    sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null,
    coresOrigemSinal: null, ehMartingale: false // 'coresOrigemSinal' mantido por consistência de chave, mas armazena resultados
};
let sinalOriginalParaMartingaleBacBo = null;
let ultimosGatilhosProcessadosBacBo = {};
let ultimoSinalResolvidoInfoBacBo = {
    gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0 // 'coresQueFormaramGatilho' mantido
};
let winsBacBo = parseInt(localStorage.getItem('bacboWins')) || 0;
let lossesBacBo = parseInt(localStorage.getItem('bacboLosses')) || 0;
let tieResultsBacBo = parseInt(localStorage.getItem('bacboTieResults')) || 0;
let martingaleWinsBacBo = parseInt(localStorage.getItem('bacboMartingaleWins')) || 0;
let lastStatsLogTimeBacBo = Date.now();

// --- DOM Elements Cache ---
const statusDivBacBo = document.getElementById('status');
const sinalTextoPBacBo = document.getElementById('sinal-texto');
const winsSpanBacBo = document.getElementById('wins');
const tieResultsSpanBacBo = document.getElementById('tie-results');
const lossesSpanBacBo = document.getElementById('losses');
const winRateSpanBacBo = document.getElementById('win-rate');
// casinoIframe e refreshIframeButton são pegos em DOMContentLoaded

// --- Funções Auxiliares de ML ---
function resultadosToInputTensorBacBo(resultadoSequence) {
    const tensorData = [];
    for (const resultado of resultadoSequence) {
        if (resultado === PLAYER_WIN) tensorData.push(1, 0);
        else if (resultado === BANKER_WIN) tensorData.push(0, 1);
        else tensorData.push(0.5, 0.5);
    }
    return tf.tensor2d([tensorData], [1, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]);
}

function prepareTrainingDataBacBo(historicoResultados) {
    const xs_data = []; const ys_data = [];
    if (!historicoResultados || historicoResultados.length < SEQUENCE_LENGTH_BACBO + 1) return { xs: null, ys: null };
    for (let i = 0; i <= historicoResultados.length - (SEQUENCE_LENGTH_BACBO + 1); i++) {
        const sequencia = historicoResultados.slice(i + 1, i + 1 + SEQUENCE_LENGTH_BACBO).reverse();
        const resultadoReal = historicoResultados[i];
        if ((resultadoReal === PLAYER_WIN || resultadoReal === BANKER_WIN) && !sequencia.includes(TIE_RESULT) && !sequencia.includes(INVALID_RESULT)) {
            const inputFeatures = []; let sequenciaValidaParaInput = true;
            for (const res of sequencia) {
                if (res === PLAYER_WIN) inputFeatures.push(1, 0);
                else if (res === BANKER_WIN) inputFeatures.push(0, 1);
                else { sequenciaValidaParaInput = false; break; }
            }
            if(sequenciaValidaParaInput) {
                xs_data.push(inputFeatures);
                ys_data.push(RESULTADO_TO_INDEX_ML_BACBO[resultadoReal]);
            }
        }
    }
    if (xs_data.length === 0) return { xs: null, ys: null };
    const xTensor = tf.tensor2d(xs_data, [xs_data.length, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]);
    const yTensor = tf.oneHot(tf.tensor1d(ys_data, 'int32'), NUM_CLASSES_BACBO);
    return { xs: xTensor, ys: yTensor };
}

function createModelTFBacBo() {
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ inputShape: [SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO], units: 24, activation: 'relu' }));
    newModel.add(tf.layers.dropout({ rate: 0.3 }));
    newModel.add(tf.layers.dense({ units: NUM_CLASSES_BACBO, activation: 'softmax' }));
    newModel.compile({ optimizer: tf.train.adam(0.002), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    console.log("Modelo TensorFlow.js para Bac Bo criado.");
    return newModel;
}

async function trainModelTFBacBo(historicoResultados) {
    if (isTrainingBacBo || typeof tf === 'undefined' || !modelBacBo) return;
    if (!historicoResultados || historicoResultados.length < SEQUENCE_LENGTH_BACBO + 1) return;
    const { xs, ys } = prepareTrainingDataBacBo(historicoResultados);
    if (!xs || xs.shape[0] === 0) { if(xs) xs.dispose(); if(ys) ys.dispose(); return; }
    isTrainingBacBo = true;
    try {
        const batchSize = Math.max(4, Math.floor(xs.shape[0] / 4) || 4);
        await modelBacBo.fit(xs, ys, {
            epochs: 12, batchSize: batchSize, shuffle: true,
            callbacks: { /* onEpochEnd: (epoch, logs) => { console.log(`Época TF ${epoch+1}: L=${logs.loss.toFixed(3)} A=${logs.acc.toFixed(3)}`); } */ }
        });
    } catch (error) { console.error("Erro Treinamento TF.js BacBo:", error); }
    finally { isTrainingBacBo = false; xs.dispose(); ys.dispose(); }
}

async function verificarSinalComMLBacBo(resultadosRecentes) {
    if (typeof tf === 'undefined' || !modelBacBo || !resultadosRecentes || resultadosRecentes.length < SEQUENCE_LENGTH_BACBO) return [null, null, null];
    const sequenciaParaPrever = resultadosRecentes.slice(0, SEQUENCE_LENGTH_BACBO).reverse();
    if (sequenciaParaPrever.includes(TIE_RESULT) || sequenciaParaPrever.includes(INVALID_RESULT)) return [null, null, null];
    let inputTensor;
    try {
        inputTensor = resultadosToInputTensorBacBo(sequenciaParaPrever);
        const predictionTensor = modelBacBo.predict(inputTensor);
        const predictionData = await predictionTensor.data();
        tf.dispose(predictionTensor);
        const probPlayer = predictionData[0]; const probBanker = predictionData[1];
        console.log(`[BacBo ML Previsão] Após [${sequenciaParaPrever.join(',')}]: Player=${probPlayer.toFixed(3)}, Banker=${probBanker.toFixed(3)}`);
        let sinalGerado = null;
        if (probPlayer > probBanker && probPlayer >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = PLAYER_WIN;
        else if (probBanker > probPlayer && probBanker >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = BANKER_WIN;
        else if (probPlayer >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = PLAYER_WIN;
        else if (probBanker >= ML_CONFIDENCE_THRESHOLD_BACBO) sinalGerado = BANKER_WIN;
        if (sinalGerado) {
            const confianca = (sinalGerado === PLAYER_WIN) ? probPlayer : probBanker;
            const resultadosGatilhoApiOrder = [...sequenciaParaPrever].reverse();
            return [sinalGerado, resultadosGatilhoApiOrder.join(','), resultadosGatilhoApiOrder];
        }
    } catch (error) { console.error("Erro na previsão ML BacBo:", error); }
    finally { if (inputTensor) inputTensor.dispose(); }
    return [null, null, null];
}

// --- Funções Principais do Bot ---
function updateStatusBacBo(message, isError = false, isSuccess = false) {
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
        // console.log("DADOS COMPLETOS DA API BAC BO:", JSON.stringify(dados, null, 2)); // Descomente para depurar a API
        const NOME_CHAVE_API_BACBO = "history"; // Corrigido conforme API
        if (dados && dados[NOME_CHAVE_API_BACBO] && Array.isArray(dados[NOME_CHAVE_API_BACBO])) {
            const resultadosCrus = dados[NOME_CHAVE_API_BACBO];
            if (resultadosCrus.length > 0) {
                if (typeof identificarResultadoBacBo !== 'function') { updateStatusBacBo("Erro: `identificarResultadoBacBo` não definida.", true); return null; }
                const resultadosProcessados = resultadosCrus.map(identificarResultadoBacBo);
                const resultadosValidos = resultadosProcessados.filter(r => r !== INVALID_RESULT);
                if (resultadosValidos.length === 0) { updateStatusBacBo("Nenhum resultado válido (BacBo).", true); return null; }
                return resultadosValidos;
            }
        }
        updateStatusBacBo(`Dados API (BacBo) formato inesperado. Esperando chave: ${NOME_CHAVE_API_BACBO}`, true); return null;
    } catch (error) {
        if (error.name === 'AbortError') updateStatusBacBo("Timeout API (BacBo).", true);
        else updateStatusBacBo(`ERRO FETCH (BacBo): ${error.message.substring(0,30)}`, true);
        console.error("Erro fetch (BacBo):", error); return null;
    }
}

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
        sinalEsperado: resultadoSinal, gatilhoPadrao: gatilhoId, timestampGerado: agora,
        coresOrigemSinal: [...resultadosGatilho], ehMartingale: ehMartingaleIntent
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
    console.log(`SINAL DEFINIDO: ${ultimoSinalBacBo.sinalEsperado} ${ultimoSinalBacBo.ehMartingale ? '(MG1)' : ''} | Gatilho: ${ultimoSinalBacBo.gatilhoPadrao}`);
    return true;
}

function verificarResultadoSinalBacBo(novoResultadoRegistrado) {
    if (!ultimoSinalBacBo.sinalEsperado) return;
    const sinalResolvido = { ...ultimoSinalBacBo };
    let msgResultado = "", resultadoCorTexto = "var(--accent-color)";
    let cicloEncerradoComVitoria = false;
    let cicloEncerradoComPerda = false;
    console.log(`VERIFICANDO RESULTADO: Sinal era ${sinalResolvido.sinalEsperado} ${sinalResolvido.ehMartingale ? '(MG1)' : ''}, Saiu: ${novoResultadoRegistrado}`);

    if (novoResultadoRegistrado === TIE_RESULT) {
        tieResultsBacBo++;
        msgResultado = "⚠️ EMPATE!";
        resultadoCorTexto = "var(--warning-color)";
        if (sinalResolvido.ehMartingale) {
             msgResultado = "⚠️ EMPATE NO MARTINGALE! (Ciclo encerrado)";
             cicloEncerradoComPerda = true; // Considera perda do ciclo de aposta do Martingale
        } else {
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            if (sinalTextoPBacBo) {
                sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
                sinalTextoPBacBo.style.color = resultadoCorTexto;
            }
            console.log(`Empate no sinal normal (${sinalResolvido.sinalEsperado}). Preparando para Martingale 1 na mesma aposta.`);
            atualizarEstatisticasBacBo();
            return;
        }
    } else if (novoResultadoRegistrado === sinalResolvido.sinalEsperado) {
        cicloEncerradoComVitoria = true;
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        if(sinalResolvido.ehMartingale) martingaleWinsBacBo++;
        resultadoCorTexto = "var(--success-color)";
    } else {
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            cicloEncerradoComPerda = true;
            resultadoCorTexto = "var(--danger-color)";
        } else {
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            console.log(`Falha no sinal normal (${sinalResolvido.sinalEsperado}). Preparando para Martingale 1.`);
            return;
        }
    }

    if (cicloEncerradoComVitoria) winsBacBo++;
    else if (cicloEncerradoComPerda) lossesBacBo++;

    if (sinalTextoPBacBo) {
        sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoPBacBo.style.color = resultadoCorTexto;
    }
    updateStatusBacBo(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0]}`, false, cicloEncerradoComVitoria);
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
        if (typeof tf !== 'undefined' && modelBacBo) {
             await trainModelTFBacBo(resultadosRecebidosDaAPI);
        }
        const dadosMudaram = (JSON.stringify(resultadosRecebidosDaAPI) !== JSON.stringify(ultimosResultadosApiBacBo));
        if (dadosMudaram || ultimosResultadosApiBacBo.length === 0) {
            ultimosResultadosApiBacBo = [...resultadosRecebidosDaAPI];
        }
        if (statusDivBacBo && !statusDivBacBo.title.startsWith("Erro:") && !ultimoSinalBacBo.sinalEsperado && !sinalOriginalParaMartingaleBacBo) {
             updateStatusBacBo("API BacBo OK. Monitorando...", false, true);
        }

        if (ultimoSinalBacBo.sinalEsperado && dadosMudaram) {
            verificarResultadoSinalBacBo(ultimosResultadosApiBacBo[0]);
        }

        const podeGerarSinalML = ultimosResultadosApiBacBo.length >= SEQUENCE_LENGTH_BACBO;
        if (!ultimoSinalBacBo.sinalEsperado && (dadosMudaram || (podeGerarSinalML && ultimosResultadosApiBacBo.length === SEQUENCE_LENGTH_BACBO) )) {
            if (sinalOriginalParaMartingaleBacBo) {
                const resultadoMartingale = sinalOriginalParaMartingaleBacBo.sinalEsperado;
                const gatilhoOriginal = sinalOriginalParaMartingaleBacBo.gatilhoPadrao;
                const resultadosOriginais = sinalOriginalParaMartingaleBacBo.coresOrigemSinal;
                definirSinalAtivoBacBo(resultadoMartingale, gatilhoOriginal, resultadosOriginais, true);
            } else {
                if (typeof tf !== 'undefined' && modelBacBo && podeGerarSinalML) {
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

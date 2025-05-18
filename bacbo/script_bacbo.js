// script_bacbo.js (CORREÇÕES FINAIS para Martingale, Contagem e Empate)

// --- Configuration (sem alterações) ---
const TARGET_API_URL_BACBO = 'https://onixapis.com:2083/public/api/evolution/bacbo-ao-vivo';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL_BACBO)}`;
const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 6000;
const SIGNAL_COOLDOWN = pra considerar green"), você talvez queira que o TIE não conte como uma perda que ative o Martingale *imediatamente* ou que não quebre uma sequência de vitórias se você não estava apostando em TIE. No entanto, para a aposta P/B, ele não foi um acerto.
    *   **Vamos implementar a Opção A modificada:** TIE não é win/loss para P/B, incrementa `tieResultsBacBo`. Se um sinal P/B estava ativo e sai TIE, ativamos o Martingale para o *mesmo lado* (P/B) que foi apostado originalmente.

2.  **Contabilização Descontrolada (Erro/Acerto sem Sinal):**
    *   **Causa Provável:** A função `verificarResultadoSinalBacBo` pode estar sendo chamada e processando um resultado mesmo quando `ultimoSinalBacBo.sinal 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações (sem alterações) ---
let modelBacBo;
const SEQUENCE_LENGTH_BACBO = 5;
const NUM_FEATURES_PER_RESULT_BACBO = 2;
const NUM_CLASSES_BACBO = 2;
let isTrainingBacBo = false;
const ML_CONFIDENCE_THRESHOLD_BACBO = 0.58;

const PLAYER_WIN = "PLAYER"; // Assumindo que estão definidos em resultados_bacbo.js
const BANKER_WIN = "BANKER";
const TIE_RESULT = "TIE";
const INVALID_RESULT = "inválido";

const RESULTADO_TO_INDEX_ML_BACBO = { [PLAYER_WIN]: 0, [BANKER_WIN]: 1 };
const INDEX_TO_RESULTADO_ML_BACBO = { 0: PLAYER_WIN, 1: BANKER_WIN };

// --- Global State (sem alterações na estrutura) ---
let ultimosResultadosApiBacBo = [];
let ultimoSinalBacBo = {
    sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null,
    coresOrigemSinalEsperado` é `null`, ou o estado de `ultimoSinalBacBo` não está sendo limpo corretamente após cada resolução, fazendo com que uma rodada subsequente seja interpretada como resultado de um sinal fantasma.
    *   **Correção:** Garantir que `verificarResultadoSinalBacBo` só execute sua lógica principal se `ultimoSinalBacBo.sinalEsperado` estiver de fato definido. E garantir que `ultimoSinalBacBo` seja resetado (`sinalEsperado = null`) após cada ciclo resolvido (ganho, perda, ou mesmo um TIE que encerre o ciclo de Martingale).

3.  **Sinal de Martingale Após Acerto:**
    *   Isso não deveria acontecer. Se o sinal original acerta, `sinalOriginalParaMartingaleBacBo` não deve ser setado, e `ultimoSinalBacBo` deve ser limpo para indicar que não há sinal ativo.

**Código `script_bacbo.js` Corrigido:**

```javascript
// script_bacbo.js (CORREÇÕES FINAIS para Martingale, Contagem, TIE)

// --- Configuration --- (sem alterações)
const TARGET_API_URL_BACBO = 'https://onixapis.com:2083/public/api/evolution/bacbo-ao-vivo';
const PROXY: null, ehMartingale: false
};
let sinalOriginalParaMartingaleBacBo = null;
let ultimosGatilhosProcessadosBacBo = {};
let ultimoSinalResolvidoInfoBacBo = {
    gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0
};
let winsBacBo = parseInt(localStorage.getItem('bacboWins')) || 0;
let lossesBacBo = parseInt(localStorage.getItem('bacboLosses')) || 0;
let tieResultsBacBo = parseInt(localStorage.getItem('bacboTieResults')) || 0;
let martingaleWinsBacBo = parseInt(localStorage.getItem('bacboMartingaleWins')) || 0;
let lastStatsLogTimeBacBo = Date.now();

// --- DOM Elements Cache (sem alterações) ---
const statusDivBacBo = document.getElementById('status');
const sinalTextoPBacBo = document.getElementById('sinal-texto');
const winsSpanBacBo = document.getElementById('wins');
const tieResultsSpanBacBo = document.getElementById('tie-results');
const lossesSpanBacBo = document.getElementById('losses');
const winRateSpanBacBo = document.getElementById('win-rate');

// --- Funções Auxiliares de ML (sem alterações) ---
function resultadosToInputTensorBacBo(resultadoSequence) { /* ...como antes... */
    const tensorData = [];
    for (const resultado of resultadoSequence) {
        if (resultado === PLAYER_WIN) tensorData.push(1, 0);
        else if (resultado === BANKER_WIN) tensorData.push(0, 1);
        else tensorData.push(0.5, 0.5);
    }
    return tf.tensor2d([tensorData], [1, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]);
}
function prepareTrainingDataBacBo(historicoResultados) { /* ...como antes... */
    const xs_data = []; const ys_data = [];
    if (!historicoResultados || historicoResultados.length < SEQUENCE_LENGTH_BACBO + 1)_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL_BACBO)}`;
const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 6000;
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- TensorFlow.js Configurações --- (sem alterações)
let modelBacBo;
const SEQUENCE_LENGTH_BACBO = 5;
const NUM_FEATURES_PER_RESULT_BACBO = 2;
const NUM_CLASSES_BACBO = 2;
let isTrainingBacBo = false;
const ML_CONFIDENCE_THRESHOLD_BACBO = 0.58;

const PLAYER_WIN = "PLAYER"; const BANKER_WIN = "BANKER"; const TIE_RESULT = "TIE"; const INVALID_RESULT = "inválido";
const RESULTADO_TO_INDEX_ML_BACBO = { [PLAYER_WIN]: 0, [BANKER_WIN]: 1 };
const INDEX_TO_RESULTADO_ML_BACBO = { 0: PLAYER_WIN, 1: BANKER_WIN };

// --- Global State ---
let ultimosResultadosApiBacBo = [];
let ultimoSinalBacBo = {
    sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null,
    coresOrigemSinal: null, ehMartingale: false
};
let sinalOriginalParaMartingaleBacBo = null;
let ultimosGatilhosProcessadosBacBo = {};
let ultimoSinalResolvidoInfoBacBo = {
    gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0
};
let winsBacBo = parseInt(localStorage.getItem('bacboWins')) || 0;
let lossesBacBo = parseInt(localStorage.getItem('bacboLosses')) || 0;
let tieResultsBacBo = parseInt(localStorage.getItem('bacboTieResults')) || 0;
let martingaleWinsBacBo = parseInt(localStorage.getItem('bacboMartingaleWins')) || 0;
let lastStatsLogTimeBacBo = Date.now();

// --- DOM Elements Cache --- (sem alterações)
const statusDivBacBo = document.getElementById('status');
const sinalTextoPBacBo = document.getElementById('sinal-texto');
const winsSpanBacBo = document.getElementById('wins');
const tieResultsSpanBacBo = document.getElementById('tie-results');
const lossesSpanBacBo = document.getElementById('losses');
const winRateSpanBacBo = document.getElementById('win-rate');

// --- Funções Auxiliares de ML --- (sem alterações) return { xs: null, ys: null };
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
function createModelTFBacBo() { /* ...como antes... */
    const newModel = tf.sequential();
    newModel.add(tf.layers.dense({ inputShape: [SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO], units: 24, activation: 'relu' }));
    newModel.add(tf.layers.dropout({ rate: 0.3 }));
    newModel.add(tf.layers.dense({ units: NUM_CLASSES_BACBO, activation: 'softmax' }));
    newModel.compile({ optimizer: tf.train.adam(0.002), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    console.log("Modelo TensorFlow.js para Bac Bo criado.");
    return newModel;
}
async function trainModelTFBacBo(historicoResultados) { /* ...como antes... */
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
async function verificarSinalComMLBacBo(resultadosRecentes) { /* ...como antes... */
    if
function resultadosToInputTensorBacBo(rs) { /* ... */ return tf.tensor2d([rs.reduce((acc, r) => acc.concat(r === PLAYER_WIN ? [1,0] : r === BANKER_WIN ? [0,1] : [0.5,0.5]), [])], [1, SEQUENCE_LENGTH_BACBO * NUM_FEATURES_PER_RESULT_BACBO]); }
function prepareTrainingDataBacBo(hr) { const x = [], y = []; if (!hr || hr.length < SEQUENCE_LENGTH_BACBO + 1) return {xs:null,ys:null}; for (let i=0; i<=hr.length-(SEQUENCE_LENGTH_BACBO+1); i++) { const s=hr.slice(i+1,i+1+SEQUENCE_LENGTH_BACBO).reverse(), r=hr[i]; if((r===PLAYER_WIN||r===BANKER_WIN)&&!s.includes(TIE_RESULT)&&!s.includes(INVALID_RESULT)){let v=true,f=[];for(const e of s){if(e===PLAYER_WIN)f.push(1,0);else if(e===BANKER_WIN)f.push(0,1);else{v=false;break}}if(v){x.push(f);y.push(RESULTADO_TO_INDEX_ML_BACBO[r])}}} return x.length===0?{xs:null,ys:null}:{xs:tf.tensor2d(x,[x.length,SEQUENCE_LENGTH_BACBO*NUM_FEATURES_PER_RESULT_BACBO]),ys:tf.oneHot(tf.tensor1d(y,'int32'),NUM_CLASSES_BACBO)}; }
function createModelTFBacBo() { const m=tf.sequential(); m.add(tf.layers.dense({inputShape:[SEQUENCE_LENGTH_BACBO*NUM_FEATURES_PER_RESULT_BACBO],units:24,activation:'relu'})); m.add(tf.layers.dropout({rate:0.3})); m.add(tf.layers.dense({units:NUM_CLASSES_BACBO,activation:'softmax'})); m.compile({optimizer:tf.train.adam(0.002),loss:'categoricalCrossentropy',metrics:['accuracy']}); console.log("Modelo TF.js BacBo criado."); return m; }
async function trainModelTFBacBo(hr) { if(isTrainingBacBo||typeof tf==='undefined'||!modelBacBo||!hr||hr.length<SEQUENCE_LENGTH_BACBO+1)return;const{xs,ys}=prepareTrainingDataBacBo(hr);if(!xs||xs.shape[0]===0){if(xs)xs.dispose();if(ys)ys.dispose();return}isTrainingBacBo=true;try{const b=Math.max(4,Math.floor(xs.shape[0]/4)||4);await modelBacBo.fit(xs,ys,{epochs:12,batchSize:b,shuffle:true,callbacks:{}})}catch(e){console.error("Erro Treino TF BacBo:",e)}finally{isTrainingBacBo=false;xs.dispose();ys.dispose()}}
async function verificarSinalComMLBacBo(rr) { if(typeof tf==='undefined'||!modelBacBo||!rr||rr.length<SEQUENCE_LENGTH_BACBO)return[null,null,null];const s=rr.slice(0,SEQUENCE_LENGTH_BACBO).reverse();if(s.includes(TIE_RESULT)||s.includes(INVALID_RESULT))return[null,null,null];let t;try{t=resultadosToInputTensorBacBo(s);const pT=modelBacBo.predict(t),pD=await pT.data();tf.dispose(pT);const pP=pD[0],pB=pD[1];console.log(`[BacBo ML Previsão] Após [${s.join(',')}]: P=${pP.toFixed(3)}, B=${pB.toFixed(3)}`);let sig=null;if(pP>pB&&pP>=ML_CONFIDENCE_THRESHOLD_BACBO)sig=PLAYER_WIN;else if(pB>pP&&pB>=ML_CONFIDENCE_THRESHOLD_BACBO)sig=BANKER_WIN;else if(pP>=ML_CONFIDENCE_THRESHOLD (typeof tf === 'undefined' || !modelBacBo || !resultadosRecentes || resultadosRecentes.length < SEQUENCE_LENGTH_BACBO) return [null, null, null];
    const sequenciaParaPrever = resultadosRecentes.slice(0, SEQUENCE_LENGTH_BACBO).reverse();
    if (sequenciaParaPrever.includes(TIE_RESULT) || sequenciaParaPrever.includes(INVALID_RESULT)) return [null, null, null];
    let inputTensor;
    try {
        inputTensor = resultadosToInputTensorBacBo(sequenciaParaPrever);
        const predictionTensor = modelBacBo.predict(inputTensor);
        const predictionData = await predictionTensor.data();
        tf.dispose(predictionTensor);
        const probPlayer = predictionData[0]; const probBanker = predictionData[1];
        // console.log(`[BacBo ML Previsão] Após [${sequenciaParaPrever.join(',')}]: Player=${probPlayer.toFixed(3)}, Banker=${probBanker.toFixed(3)}`);
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
function updateStatusBacBo(message, isError = false, isSuccess = false) { /* ...como antes... */
    if (statusDivBacBo) {
        let iconClass = 'fa-info-circle'; let color = 'dodgerblue'; let titleMessage = `Info: ${message}`;
        if (isError) { iconClass = 'fa-times-circle'; color = 'crimson'; titleMessage = `Erro: ${message}`; }
        else if (isSuccess) { iconClass = 'fa-check-circle'; color = 'green'; titleMessage = `Status: ${message}`; }
        statusDivBacBo.innerHTML = `<i class="fas ${iconClass}"></i>`; statusDivBacBo.style.color = color; statusDivBacBo.title = titleMessage;
    }
    if (isError) console.error(message);
}
async function obterResultadosApiBacBo() { /* ...como antes... */
    try {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(API_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) { updateStatusBacBo(`Erro HTTP ${response.status} (BacBo)`, true); return null; }
        const dados = await response.json();
        const NOME_CHAVE_API_BACBO = "history";
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

function definirSinalAtivoBacBo(resultadoSinal, gatilhoId, resultadosGatilho, ehMartingaleIntent) { /* ...como antes... */
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
    ultimosGatilhosProcessados_BACBO)sig=PLAYER_WIN;else if(pB>=ML_CONFIDENCE_THRESHOLD_BACBO)sig=BANKER_WIN;if(sig){const rG=[...s].reverse();return[sig,rG.join(','),rG]}}catch(e){console.error("Erro Previsão ML BacBo:",e)}finally{if(t)t.dispose()}return[null,null,null]}

// --- Funções Principais do Bot ---
function updateStatusBacBo(m,e=!1,s=!1){if(statusDivBacBo){let i='fa-info-circle',c='dodgerblue',t=`Info: ${m}`;e?(i='fa-times-circle',c='crimson',t=`Erro: ${m}`):s&&(i='fa-check-circle',c='green',t=`Status: ${m}`);statusDivBacBo.innerHTML=`<i class="fas ${i}"></i>`;statusDivBacBo.style.color=c;statusDivBacBo.title=t}e&&console.error(m)}
async function obterResultadosApiBacBo(){try{const c=new AbortController,t=setTimeout(()=>c.abort(),API_TIMEOUT),r=await fetch(API_URL,{method:'GET',cache:'no-store',signal:c.signal});if(clearTimeout(t),!r.ok)return updateStatusBacBo(`Erro HTTP ${r.status} (BacBo)`,!0),null;const d=await r.json(),N="history";if(d&&d[N]&&Array.isArray(d[N])){const r=d[N];if(r.length>0){if("function"!=typeof identificarResultadoBacBo)return updateStatusBacBo("Erro: `identificarResultadoBacBo` não definida.",!0),null;const t=r.map(identificarResultadoBacBo).filter(r=>r!==INVALID_RESULT);return t.length===0?(updateStatusBacBo("Nenhum resultado válido (BacBo).",!0),null):t}}return updateStatusBacBo(`Dados API (BacBo) formato inesperado. Esperando chave: ${N}`,!0),null}catch(e){"AbortError"===e.name?updateStatusBacBo("Timeout API (BacBo).",!0):updateStatusBacBo(`ERRO FETCH (BacBo): ${e.message.substring(0,30)}`,!0);console.error("Erro fetch (BacBo):",e);return null}}

function definirSinalAtivoBacBo(rS, gId, rG, ehMG) { // rS: resultadoSinal, gId: gatilhoId, rG: resultadosGatilho, ehMG: ehMartingaleIntent
    if (!rS) return false;
    const agora = Date.now();
    if (!ehMG) { // Só aplica cooldowns se não for um Martingale sendo forçado
        if (ultimosGatilhosProcessadosBacBo[gId] && (agora - ultimosGatilhosProcessadosBacBo[gId] < SIGNAL_COOLDOWN)) return false;
        const resolvidoRecent = (agora - ultimoSinalResolvidoInfoBacBo.timestampResolvido < SIGNAL_COOLDOWN) &&
                                ultimoSinalResolvidoInfoBacBo.gatilhoPadrao === gId &&
                                JSON.stringify(ultimoSinalResolvidoInfoBacBo.coresQueFormaramGatilho) === JSON.stringify(rG);
        if (resolvidoRecent) return false;
    }
    ultimoSinalBacBo = {
        sinalEsperado: rS, gatilhoPadrao: gId, timestampGerado: agora,
        coresOrigemSinal: [...rG], ehMartingale: ehMG
    };
    ultimosGatilhosProcessadosBacBo[gId] = agora;
    if (ehMG) sinalOriginalParaMartingaleBacBo = null; // Martingale definido, limpa necessidade

    const sU = ultimoSinalBacBo.sinalEsperado.toUpperCase();
    const nomeSinal = "OPORTUNIDADE BACBO";
    const msg = ultimoSinalBacBo.ehMartingale ? `🔄 MARTINGALE 1\n➡️ Entrar no ${sU}` : `🎲 ${nomeSinal}\n➡️ Entrar no ${sU}`;
    const color = ultimoSinalBacBo.ehMartingale ? "var(--secondary-color)" : "var(--accent-color)";

    if (sinalTextoPBacBo) {
        sinalTextoPBacBo.innerHTML = msg.replace(/\n/g, '<br>');
        sinalTextoPBacBo.style.color = color;
        const ph = sinalTextoPBacBo.querySelector('.signal-placeholder');
        if(ph) ph.remove();
    }
    updateStatusBacBo(`Sinal: ${sU}${ultimoSinalBacBo.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
    console.log(`SINAL ATIVO: ${sU} ${ultimoSinalBacBo.ehMartingale ? '(MG1)' : ''} | Gatilho: ${gId}`);
    return true;
}

// CORRIGIDO E REFINADO: verificarResultadoSinalBacBo
function verificarResultadoSinalBacBo(novoResultadoRegistrado) {
    if (!ultimoSinalBacBo.sinalEsperado) {
        // NENHUM SINAL ATIVO PARA VERIFICAR. ISSO É IMPORTANTE.
        // Se chegamos aqui sem um sinal ativo, não fazemos nada de contabilização.
        return;
    }

    const sinalResolvido = { ...ultimoSinalBacBo }; // Copia o sinal que estava ativo
    let msgResultado = "", resultadoCorTexto = "var(--accent-BacBo[gatilhoId] = agora;
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
    // console.log(`SINAL DEFINIDO: ${ultimoSinalBacBo.sinalEsperado} ${ultimoSinalBacBo.ehMartingale ? '(MG1)' : ''} | Gatilho: ${ultimoSinalBacBo.gatilhoPadrao}`);
    return true;
}

// REVISADO: verificarResultadoSinalBacBo
function verificarResultadoSinalBacBo(novoResultadoRegistrado) {
    if (!ultimoSinalBacBo.sinalEsperado) { // Nenhum sinal ativo para verificar
        return;
    }

    const sinalResolvido = { ...ultimoSinalBacBo }; // Copia o sinal que estava ativo
    let msgResultado = "", resultadoCorTexto = "var(--accent-color)";
    let cicloEncerrou = false; // Flag para indicar se o ciclo de aposta (sinal ou sinal+MG) terminou.
    let vitoriaNoCiclo = false; // Flag para indicar se o ciclo resultou em vitória.

    console.log(`[RESULTADO] Sinal: ${sinalResolvido.sinalEsperado}${sinalResolvido.ehMartingale ? '(MG1)' : ''}. Saiu: ${novoResultadoRegistrado}`);

    if (novoResultadoRegistrado === TIE_RESULT) {
        tieResultsBacBo++; // Sempre conta o Tie
        msgResultado = "⚠️ EMPATE!";
        resultadoCorTexto = "var(--warning-color)";

        if (sinalResolvido.ehMartingale) {
            // TIE no Martingale: consideramos o ciclo perdido.
            msgResultado = "⚠️ EMPATE NO MARTINGALE! (Ciclo perdido)";
            cicloEncerrou = true;
            vitoriaNoCiclo = falsecolor)";
    let cicloGanho = false; // O ciclo de aposta (sinal ou sinal+MG) foi ganho?
    let cicloPerdido = false; // O ciclo de aposta foi perdido?
    let necessitaMartingale = false;

    console.log(`RESOLVENDO SINAL: Esperado ${sinalResolvido.sinalEsperado} ${sinalResolvido.ehMartingale ? '(MG1)' : ''}, Saiu: ${novoResultadoRegistrado}`);

    if (novoResultadoRegistrado === TIE_RESULT) {
        tieResultsBacBo++; // Sempre contabiliza o TIE
        msgResultado = "⚠️ EMPATE!";
        resultadoCorTexto = "var(--warning-color)";
        if (sinalResolvido.ehMartingale) {
            msgResultado = "⚠️ EMPATE NO MARTINGALE! (Ciclo perdido)";
            cicloPerdido = true; // TIE no Martingale geralmente significa perda da aposta do Martingale
        } else {
            // TIE no sinal normal -> Prepara para Martingale na MESMA aposta P/B
            necessitaMartingale = true;
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            console.log(`Empate no sinal normal (${sinalResolvido.sinalEsperado}). Preparando; // Perdeu a aposta do Martingale
            console.log("[RESULTADO] Empate no Martingale. Ciclo encerrado com perda.");
        } else {
            // TIE no sinal normal: Prepara para Martingale na mesma aposta.
            console.log(`[RESULTADO] Empate no sinal (${sinalResolvido.sinalEsperado}). Preparando Martingale.`);
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            // Limpa o sinal ativo atual. mainLoop tentará definir o Martingale.
            // Não define cicloEncerrou=true aqui, pois o ciclo continua com o Martingale.
        }
    } else if (novoResultadoRegistrado === sinalResolvido.sinalEsperado) {
        // Acerto (Player ou Banker)
        cicloEncerrou = true;
        vitoriaNoCiclo = true;
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        if (sinalResolvido.ehMartingale) martingaleWinsBacBo++;
        resultadoCorTexto = "var(--success-color)";
        console.log(`[RESULTADO] Acerto! ${sinalResolvido.ehMartingale ? 'no Martingale.' : 'no sinal normal.'}`);
    } else { // Perdeu (Player vs Banker, não foi Tie)
        if (sinalResolvido.ehMartingale) {
            // Perdeu no Martingale
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            cicloEncerrou = true;
            vitoria Martingale.`);
        }
    } else if (novoResultadoRegistrado === sinalResolvido.sinalEsperado) {
        cicloGanho = true;
        msgResultado = sinalResolvido.ehMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        if(sinalResolvido.ehMartingale) martingaleWinsBacBo++;
        resultadoCorTexto = "var(--success-color)";
    } else { // Perdeu (P vs B, não foi Tie)
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! NoCiclo = false;
            resultadoCorTexto = "var(--danger-color)";
            console.log("[RESULTADO] Erro no Martingale. Ciclo encerrado com perda.");
        } else {
            // Sinal normal falhou: Prepara para Martingale
            console.log(`[RESULTADO] Falha no sinal (${👎";
            cicloPerdido = true;
            resultadoCorTexto = "var(--danger-colorsinalResolvido.sinalEsperado}). Preparando Martingale.`);
            sinalOriginalParaMartingale)";
        } else {
            // Sinal normal falhou (não foi Tie) -> Prepara para Martingale
            BacBo = { ...sinalResolvido };
            // Não define cicloEncerrou=true aqui.necessitaMartingale = true;
            sinalOriginalParaMartingaleBacBo = { ...sinalResolvido };
            console.log(`Falha no sinal normal (${sinalResolvido.sinalEsperado
        }
    }

    // Se o ciclo não encerrou (ou seja, um sinal normal falhou ou empatou e vai para Martingale),
    // limpamos o ultimoSinalBacBo para que o mainLoop possa tentar}). Preparando Martingale.`);
        }
    }

    // Atualiza wins/losses APENAS se o ciclo realmente encerrou (ganhou ou perdeu definitivamente)
    if (cicloGanho) {
 definir o Martingale.
    if (!cicloEncerrou) {
        ultimoSinalBacBo = { sinal        winsBacBo++;
        console.log("CICLO GANHO!");
    } else if (cicloPerdidoEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null) {
        lossesBacBo++;
        console.log("CICLO PERDIDO!");
    }

, ehMartingale: false };
        // Atualiza o display com "EMPATE!" se foi um tie que    // Limpa o sinal ativo SEMPRE após um resultado, a menos que um Martingale seja preparado
    ultimo levou ao Martingale
        if (novoResultadoRegistrado === TIE_RESULT && sinalTextoPBacBo) {
SinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, cores            sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
            OrigemSinal: null, ehMartingale: false };

    if (necessitaMartingale) {
sinalTextoPBacBo.style.color = resultadoCorTexto;
        }
        atualizarEstatisticas        // Se precisa de Martingale, não mostramos resultado final ainda,
        // apenas a mensagem de Empate (seBacBo(); // Para registrar o TIE
        return; // Sai para o mainLoop tentar o Martingale
    }

    // Se o ciclo encerrou (vitória, ou perda no Martingale, ou Tie no Martingale): foi o caso) e esperamos o mainLoop tentar o Martingale.
        if (novoResultadoRegistrado === TIE_RESULT
    if (vitoriaNoCiclo) {
        winsBacBo++;
    } else { // Perda && sinalTextoPBacBo) { // Mostra msg de empate se foi tie no sinal normal
             sinalTextoPB no Martingale ou Tie no Martingale (considerado perda do ciclo)
        lossesBacBo++;
    }

acBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
             sinalTextoPBac    // Exibe resultado final do ciclo e limpa estado
    if (sinalTextoPBacBo) {Bo.style.color = resultadoCorTexto;
        }
        // Não limpa sinalOriginalParaMartingale
        sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
BacBo aqui, pois mainLoop usará
    } else {
        // Ciclo realmente encerrado (ganhou        sinalTextoPBacBo.style.color = resultadoCorTexto;
    }
    updateStatusBacBo(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0, ou perdeu no MG, ou TIE no MG)
        if (sinalTextoPBacBo) {]}`, false, vitoriaNoCiclo);

    setTimeout(() => {
        if (sinalTextoPB
            sinalTextoPBacBo.innerHTML = msgResultado.replace(/\n/g, '<br>');
acBo && sinalTextoPBacBo.innerHTML.includes(msgResultado.split('\n')[0]) && !            sinalTextoPBacBo.style.color = resultadoCorTexto;
        }
        updateStatusBacultimoSinalBacBo.sinalEsperado) {
             sinalTextoPBacBo.innerHTML = `<Bo(`Resultado (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado.split('\n')[0div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal]}`, false, cicloGanho);

        setTimeout(() => {
            if (sinalTextoPBacBo &&...</span></div>`;
             sinalTextoPBacBo.style.color = "var(--gray-color)"; sinalTextoPBacBo.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal
        }
    }, 7000);

    ultimoSinalResolvidoInfoBacBo = {
BacBo.sinalEsperado) {
                 sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder        gatilhoPadrao: sinalResolvido.gatilhoPadrao,
        coresQueFormaram"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
                 Gatilho: sinalResolvido.coresOrigemSinal ? [...sinalResolvido.coresOrigsinalTextoPBacBo.style.color = "var(--gray-color)";
            }
        },emSinal] : null,
        timestampResolvido: Date.now()
    };
    ultimo 7000);

        ultimoSinalResolvidoInfoBacBo = {
            gatilhoPadraoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado:: sinalResolvido.gatilhoPadrao,
            coresQueFormaramGatilho: sinalResolvido. null, coresOrigemSinal: null, ehMartingale: false };
    sinalOriginalParaMartingaleBacBo = null; // Ciclo encerrado, limpa
    atualizarEstatisticasBacBo();
}


coresOrigemSinal,
            timestampResolvido: Date.now()
        };
        sinalfunction atualizarEstatisticasBacBo() { /* ...como antes... */
    if (winsSpanBacBo)OriginalParaMartingaleBacBo = null; // Limpa se o ciclo encerrou
    }
    atualizarEstatisticasBacBo();
}

function atualizarEstatisticasBacBo() {
    // ... (sem winsSpanBacBo.textContent = winsBacBo;
    if (tieResultsSpanBacBo) tieResultsSpanBacBo. alterações)
    if (winsSpanBacBo) winsSpanBacBo.textContent = winsBacBo;
    textContent = tieResultsBacBo;
    if (lossesSpanBacBo) lossesSpanBacBo.textContent = lossesif (tieResultsSpanBacBo) tieResultsSpanBacBo.textContent = tieResultsBacBo;
    ifBacBo;
    localStorage.setItem('bacboWins', winsBacBo.toString());
    localStorage.setItem (lossesSpanBacBo) lossesSpanBacBo.textContent = lossesBacBo;
    localStorage.setItem('bac('bacboLosses', lossesBacBo.toString());
    localStorage.setItem('bacboTieResults', tieboWins', winsBacBo.toString());
    localStorage.setItem('bacboLosses', lossesBacBo.ResultsBacBo.toString());
    localStorage.setItem('bacboMartingaleWins', martingaleWinsBacBo.toStringtoString());
    localStorage.setItem('bacboTieResults', tieResultsBacBo.toString());
    localStorage.());
    const totalCiclos = winsBacBo + lossesBacBo;
    const winRate = (totalCiclossetItem('bacboMartingaleWins', martingaleWinsBacBo.toString());
    const totalCiclos = winsBac > 0) ? (winsBacBo / totalCiclos * 100) : 0;
Bo + lossesBacBo;
    const winRate = (totalCiclos > 0) ? (winsBac    if (winRateSpanBacBo) winRateSpanBacBo.textContent = winRate.toFixed(2)Bo / totalCiclos * 100) : 0;
    if (winRateSpanBacBo) winRate + "%";
}

async function mainLoopBacBo() { /* ...como antes, mas a lógica de quandoSpanBacBo.textContent = winRate.toFixed(2) + "%";
}

async function mainLoopBacBo() {
    const resultadosRecebidosDaAPI = await obterResultadosApiBacBo();

    if (resultados gerar sinal foi sutilmente ajustada ... */
    const resultadosRecebidosDaAPI = await obterResultadosApiBacBo();
    if (resultadosRecebidosDaAPI && resultadosRecebidosDaAPI.length > 0) {RecebidosDaAPI && resultadosRecebidosDaAPI.length > 0) {
        if (typeof tf !== 'undefined' && modelBacBo) {
             await trainModelTFBacBo(resultadosRecebidos
        if (typeof tf !== 'undefined' && modelBacBo) {
             await trainModelTFBacBo(resultadosRecebidosDaAPI);
        }
        const dadosMudaram = (JSON.stringify(DaAPI);
        }
        const dadosMudaram = (JSON.stringify(resultadosRecebidosDaAPI) !== JSONresultadosRecebidosDaAPI) !== JSON.stringify(ultimosResultadosApiBacBo));
        if (.stringify(ultimosResultadosApiBacBo));
        if (dadosMudaram || ultimosResultadosApidadosMudaram || ultimosResultadosApiBacBo.length === 0) {
            ultimosResultadosBacBo.length === 0) {
            ultimosResultadosApiBacBo = [...resultadosRecebidosDaAPI];ApiBacBo = [...resultadosRecebidosDaAPI];
        }
        if (statusDivBacBo &&
        }

        if (statusDivBacBo && !statusDivBacBo.title.startsWith("Erro:") !statusDivBacBo.title.startsWith("Erro:") && !ultimoSinalBacBo.sinalEsperado && !s && !ultimoSinalBacBo.sinalEsperado && !sinalOriginalParaMartingaleBacBo) {
             updateinalOriginalParaMartingaleBacBo) {
             updateStatusBacBo("API BacBo OK. Monitorando...",StatusBacBo("API BacBo OK. Monitorando...", false, true);
        }

        // 1 false, true);
        }

        // 1. Resolver sinal ativo, se houver e os dados da. Resolver sinal ativo (se houver e os dados da API mudaram)
        //    É importante que verificar API mudaram
        if (ultimoSinalBacBo.sinalEsperado && dadosMudaram) {
            verificarResultadoSinalBacBo(ultimosResultadosApiBacBo[0]);
        }

        ResultadoSinalBacBo seja chamado ANTES de tentar gerar um novo sinal,
        //    para que o estado de ultimoSinalBacBo e sinalOriginalParaMartingaleBacBo seja atualizado corretamente.
        if (ultimoSinal// 2. Tentar gerar um novo sinal (normal ou de Martingale)
        // Só tenta se não houver um sinal já ativo E (os dados mudaram OU é a primeira vez que temos dados suficientes)
        const podeGerarSBacBo.sinalEsperado && dadosMudaram) {
            verificarResultadoSinalBacBo(ultinalML = ultimosResultadosApiBacBo.length >= SEQUENCE_LENGTH_BACBO;
        // CondimosResultadosApiBacBo[0]);
        }

        // 2. Tentar gerar um novo sinalição para tentar gerar: Sem sinal ativo E (dados mudaram OU é a primeira tentativa com dados suficientes)
        if (!ultimo (normal ou de Martingale)
        //    Só tenta se não houver um sinal já ativo E os dados mudaram (ou é o início)
        const podeGerarSinalML = ultimosResultadosApiBacBo.lengthSinalBacBo.sinalEsperado && 
            (dadosMudaram || (podeGerarSinalML && >= SEQUENCE_LENGTH_BACBO;
        if (!ultimoSinalBacBo.sinalEsperado && (dados ultimosResultadosApiBacBo.length === SEQUENCE_LENGTH_BACBO && !ultimosGatilhosProcessadosBacMudaram || (podeGerarSinalML && ultimosResultadosApiBacBo.length === SEQUENCE_Bo[ultimosResultadosApiBacBo.slice(0,SEQUENCE_LENGTH_BACBO).reverse().join(',')]))
        ) {
            if (sinalOriginalParaMartingaleBacBo) { // Prioridade: Definir MartingaleLENGTH_BACBO && !isTrainingBacBo ) )) {
            if (sinalOriginalParaMartingaleBac se necessário
                const resultadoMartingale = sinalOriginalParaMartingaleBacBo.sinalEsperado; // RepBo) { // Se um Martingale é necessário
                const resultadoMartingale = sinalOriginalParaMartingaleBacBo.sinalete o mesmo lado
                const gatilhoOriginal = sinalOriginalParaMartingaleBacBo.gatilhoPadrao;Esperado; // Repete o mesmo lado
                const gatilhoOriginal = sinalOriginalParaMartingaleBacBo.gatilhoPadrao;
                const resultadosOriginais = sinalOriginalParaMartingaleBacBo.coresOrigemSinal; // Nome // Usa o mesmo gatilho
                const resultadosOriginais = sinalOriginalParaMartingaleBacBo.coresOrigemSinal da chave mantido
                
                console.log(`[MainLoop] Tentando definir Martingale BacBo para: ${;
                definirSinalAtivoBacBo(resultadoMartingale, gatilhoOriginal, resultadosOriginais, true);
            } else { // Tenta gerar sinal normal
                if (typeof tf !== 'undefined' &&resultadoMartingale.toUpperCase()}`);
                definirSinalAtivoBacBo(resultadoMartingale, gatil modelBacBo && podeGerarSinalML) {
                    const [sinalML, gatilhoMLhoOriginal, resultadosOriginais, true);
                // `sinalOriginalParaMartingaleBacBo` será nullStr, resultadosMLArr] = await verificarSinalComMLBacBo(ultimosResultadosApiBacBo);ificado dentro de `definirSinalAtivoBacBo` se o MG for setado com sucesso.

            
                    if (sinalML) {
                        definirSinalAtivoBacBo(sinalML,} else { // Tenta gerar sinal normal se não houver necessidade de Martingale
                if (typeof tf !== 'undefined gatilhoMLStr, resultadosMLArr, false);
                    }
                }
            }
        }
    }' && modelBacBo && podeGerarSinalML) {
                    const [sinalML, gatilhoMLStr
    const agora = Date.now();
    if (agora - lastStatsLogTimeBacBo >= STAT, resultadosMLArr] = await verificarSinalComMLBacBo(ultimosResultadosApiBacBo);
S_INTERVAL) { /* Log de estatísticas como antes */ }
}

function zerarEstatisticasBacBo() {                    if (sinalML) {
                        definirSinalAtivoBacBo(sinalML, gat /* ...como antes... */
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas do Bac BoilhoMLStr, resultadosMLArr, false);
                    }
                }
            }
        }
    }?")) {
        winsBacBo = 0; lossesBacBo = 0; tieResultsBacBo =

    const agora = Date.now();
    if (agora - lastStatsLogTimeBacBo >= STATS 0; martingaleWinsBacBo = 0;
        sinalOriginalParaMartingaleBacBo = null;_INTERVAL) { /* Log de estatísticas */ }
}

function zerarEstatisticasBacBo() {

        ultimoSinalBacBo = { sinalEsperado: null, gatilhoPadrao: null, timestamp    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas do Bac Bo?")) {
Gerado: null, coresOrigemSinal: null, ehMartingale: false };
        ultimosG        winsBacBo = 0; lossesBacBo = 0; tieResultsBacBo = 0; martingaleWinsBacBoatilhosProcessadosBacBo = {};
        ultimoSinalResolvidoInfoBacBo = { gatilho = 0;
        sinalOriginalParaMartingaleBacBo = null;
        ultimoSinalBacBoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0 };
        localStorage = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrig.removeItem('bacboWins'); localStorage.removeItem('bacboLosses');
        localStorage.removeItem('bacboemSinal: null, ehMartingale: false };
        ultimosGatilhosProcessadosBacBo = {};
        TieResults'); localStorage.removeItem('bacboMartingaleWins');
        atualizarEstatisticasBacBo();
ultimoSinalResolvidoInfoBacBo = { gatilhoPadrao: null, coresQueFormaramG        if (sinalTextoPBacBo) {
            sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...atilho: null, timestampResolvido: 0 };
        localStorage.removeItem('bacboWins'); localStorage</span></div>`;
            sinalTextoPBacBo.style.color = "var(--gray-color)";
.removeItem('bacboLosses');
        localStorage.removeItem('bacboTieResults'); localStorage.removeItem('bac        }
        console.warn("ESTATÍSTICAS BACBO ZERADAS!"); updateStatusBacBo("boMartingaleWins');
        atualizarEstatisticasBacBo();
        if (sinalTextoPBacEstatísticas BacBo zeradas.", false, false);
    }
}
document.addEventListener('DOMContentLoaded', () =>Bo) {
            sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
            sinalTexto { /* ...como antes... */
    if (sinalTextoPBacBo && !sinalTextoPBacBo.PBacBo.style.color = "var(--gray-color)";
        }
        console.warn("textContent.includes("OPORTUNIDADE") && !sinalTextoPBacBo.textContent.includes("MARTINGESTATÍSTICAS BACBO ZERADAS!"); updateStatusBacBo("Estatísticas BacBo zeradas.",ALE")) {
        sinalTextoPBacBo.innerHTML = `<div class="signal-placeholder"><i class false, false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (sinalTextoPB="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
        sinalTextoacBo && !sinalTextoPBacBo.textContent.includes("OPORTUNIDADE") && !sinalPBacBo.style.color = "var(--gray-color)";
    }
    if (statusDivTextoPBacBo.textContent.includes("MARTINGALE")) {
        sinalTextoPBacBo.innerHTMLBacBo) {
        statusDivBacBo.innerHTML = '<i class="fas fa-info-circle"> = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguard</i>';
        statusDivBacBo.title = "Bot BacBo (API + TF.js) Iniciadoando sinal...</span></div>`;
        sinalTextoPBacBo.style.color = "var(--gray-.";
        statusDivBacBo.style.color = 'dodgerblue';
    }
    console.color)";
    }
    if (statusDivBacBo) {
        statusDivBacBo.innerHTML =log("Bot BacBo (API + TF.js) Iniciado.");

    if (typeof tf === 'undefined '<i class="fas fa-info-circle"></i>';
        statusDivBacBo.title = "Bot') {
        console.error("TensorFlow.js (tf) não carregado! Funcionalidade de ML BacBo (API + TF.js) Iniciado.";
        statusDivBacBo.style.color = ' desabilitada.");
        updateStatusBacBo("Erro: TensorFlow.js não carregado!", true);
    } else {
        modelBacBo = createModelTFBacBo();
    }

    atualizarEdodgerblue';
    }
    console.log("Bot BacBo (API + TF.js) Iniciado.");
statisticasBacBo();
    lastStatsLogTimeBacBo = Date.now();
    mainLoopBacBo    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js (tf) não carregado!();
    setInterval(mainLoopBacBo, CHECK_INTERVAL);

    const refreshButton = document.getElementById('refresh-iframe Funcionalidade de ML desabilitada.");
        updateStatusBacBo("Erro: TensorFlow.js não carregado!", true');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            zer);
    } else {
        modelBacBo = createModelTFBacBo();
    }
    atualarEstatisticasBacBo();
            const iframe = document.getElementById('casino-iframe');
            if (izarEstatisticasBacBo();
    lastStatsLogTimeBacBo = Date.now();
    mainLoopiframe) {
                const currentSrc = iframe.src; iframe.src = 'about:blank';
                setTimeout(()BacBo();
    setInterval(mainLoopBacBo, CHECK_INTERVAL);
    const refreshButton = document.getElementById('refresh-iframe');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
 => { iframe.src = currentSrc; }, 100);
                updateStatusBacBo("Iframe atualizado,            zerarEstatisticasBacBo();
            const iframe = document.getElementById('casino-iframe');
             estatísticas BacBo zeradas.", false, false);
            }
        });
    }
});
```if (iframe) {
                const currentSrc = iframe.src; iframe.src = 'about:blank';
                

**Principais Mudanças na Lógica de `verificarResultadoSinalBacBo`:**

1.  **ClsetTimeout(() => { iframe.src = currentSrc; }, 100);
                updateStatusBacBo("areza nas Condições:** A função agora usa flags `cicloEncerrou` e `vitoriaNoCicloIframe atualizado, estatísticas BacBo zeradas.", false, false);
            }
        });
    ` para determinar o resultado final do ciclo de aposta.
2.  **Tratamento de TIE no}
});

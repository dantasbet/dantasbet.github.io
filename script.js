// script.js

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const API_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET_API_URL)}`;
const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 5000; // Atualizado para 5 segundos
const MAX_CORES_API = 20;
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000; // 10 minutos

// --- Global State ---
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,
    timestampGerado: null,
    coresOrigemSinal: null
};
let ultimosGatilhosProcessados = {};
let ultimoSinalResolvidoInfo = {
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null,
    timestampResolvido: 0
};
let wins = parseInt(localStorage.getItem('roletaWins')) || 0;
let losses = parseInt(localStorage.getItem('roletaLosses')) || 0;
let greenWins = parseInt(localStorage.getItem('roletaGreenWins')) || 0;
let lastStatsLogTime = Date.now();

// --- DOM Elements Cache ---
const statusDiv = document.getElementById('status');
const listaCoresApiUl = document.getElementById('lista-cores-api'); // Pode ser null se removido do HTML
const sinalTextoP = document.getElementById('sinal-texto');
const winsSpan = document.getElementById('wins');
const greenWinsSpan = document.getElementById('green-wins');
const lossesSpan = document.getElementById('losses');
const winRateSpan = document.getElementById('win-rate');

/**
 * Atualiza o indicador de status na UI com ícones e loga no console.
 * @param {string} message Mensagem descritiva (usada no console e no title do ícone).
 * @param {boolean} [isError=false] Se a mensagem é um erro.
 * @param {boolean} [isSuccess=false] Se a mensagem é um sucesso da API.
 */
function updateStatus(message, isError = false, isSuccess = false) {
    if (statusDiv) {
        let icon = 'ℹ️';
        let color = 'dodgerblue'; // Cor para info
        let titleMessage = `Info: ${message}`;

        if (isError) {
            icon = '❌';
            color = 'crimson'; // Cor para erro
            titleMessage = `Erro: ${message}`;
        } else if (isSuccess) {
            icon = '✅';
            color = 'green'; // Cor para sucesso
            titleMessage = `Status: ${message}`;
        }
        statusDiv.textContent = icon;
        statusDiv.style.color = color;
        statusDiv.title = titleMessage;
    }
    if (isError) {
        console.error(message);
    } else {
        console.log(message);
    }
}

async function obterCoresAPI() {
    console.log("Buscando dados da API..."); // Log para indicar tentativa
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            cache: 'no-store',
            referrerPolicy: 'no-referrer-when-downgrade',
            signal: AbortSignal.timeout(API_TIMEOUT)
        });

        if (!response.ok) {
            let errorBody = "Não foi possível ler o corpo do erro.";
            try { errorBody = await response.text(); } catch (e) { /* ignora */ }
            updateStatus(`Erro HTTP ${response.status} via proxy: ${response.statusText}`, true);
            console.error("Corpo da resposta de erro do proxy:", errorBody.substring(0, 500));
            return null;
        }

        const wrappedData = await response.json();

        if (!wrappedData || typeof wrappedData.contents !== 'string') {
            updateStatus("Proxy não retornou 'contents' como string.", true);
            return null;
        }

        const dados = JSON.parse(wrappedData.contents);

        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida da API (via proxy).", true);
                    return null;
                }
                return coresValidas;
            }
        }
        updateStatus("Formato de dados da API inesperado ou vazio (via proxy).", true);
        return null;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            updateStatus("Timeout ao buscar dados da API.", true);
        } else if (error.name === 'AbortError') {
             updateStatus("Busca de dados da API abortada.", true);
        } else {
            updateStatus(`ERRO DE FETCH: ${error.message}`, true);
        }
        console.error("Detalhes completos do erro:", error);
        return null;
    }
}

function verificarPadrao(coresRecentes) {
    if (!coresRecentes || coresRecentes.length === 0) return [null, null, null];
    for (const padraoInfo of PADROES) {
        const sequenciaPadrao = padraoInfo.sequencia;
        if (coresRecentes.length >= sequenciaPadrao.length) {
            let match = true;
            for (let i = 0; i < sequenciaPadrao.length; i++) {
                if (coresRecentes[i] !== sequenciaPadrao[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                console.info("PADRÃO GATILHO:", JSON.stringify(sequenciaPadrao), "SINAL GERADO:", padraoInfo.sinal);
                return [padraoInfo.sinal, sequenciaPadrao, coresRecentes.slice(0, sequenciaPadrao.length)];
            }
        }
    }
    return [null, null, null];
}

function gerenciarSinais(coresAtuaisAPI) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);
    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado);
        if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
            return false;
        }
        const foiResolvidoRecentemente = (agora - ultimoSinalResolvidoInfo.timestampResolvido < CHECK_INTERVAL * 2);
        if (foiResolvidoRecentemente &&
            JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
            JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora)) {
            return false;
        }
        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora]
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;
        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        const msgDisplay = `🏹 SINAL IDENTIFICADO\n➡️ Entrar no ${sinalUpper}`;
        if(sinalTextoP) sinalTextoP.textContent = msgDisplay;
        updateStatus(`Sinal: ${sinalUpper}`, false, false); // Informativo
        return true;
    }
    return false;
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return;
    const sinalQueEstavaAtivo = ultimoSinal.sinalEsperado;
    const gatilhoOriginal = ultimoSinal.gatilhoPadrao;
    const coresOrigemDoSinalAtivo = ultimoSinal.coresOrigemSinal;
    let msgResultado = "";
    if (novaCorRegistrada === 'verde') {
        msgResultado = "🎯 VITÓRIA NO VERDE! 🎰";
        wins++; greenWins++;
    } else if (novaCorRegistrada === sinalQueEstavaAtivo) {
        msgResultado = "🎯 ACERTO! ✅";
        wins++;
    } else {
        msgResultado = "❌ ERRO! 👎";
        losses++;
    }
    const statusMsg = `Resultado (${sinalQueEstavaAtivo.toUpperCase()}): ${msgResultado}`;
    if(sinalTextoP) sinalTextoP.textContent = msgResultado;
    updateStatus(statusMsg, false, false); // Informativo
    setTimeout(() => {
        if (sinalTextoP && sinalTextoP.textContent === msgResultado && !ultimoSinal.sinalEsperado) {
             sinalTextoP.textContent = "-";
        }
    }, 5000);
    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: gatilhoOriginal,
        coresQueFormaramGatilho: coresOrigemDoSinalAtivo ? [...coresOrigemDoSinalAtivo] : null,
        timestampResolvido: Date.now()
    };
    ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null };
    atualizarEstatisticasDisplay();
}

function atualizarEstatisticasDisplay() {
    if(winsSpan) winsSpan.textContent = wins;
    if(greenWinsSpan) greenWinsSpan.textContent = greenWins;
    if(lossesSpan) lossesSpan.textContent = losses;
    localStorage.setItem('roletaWins', wins.toString());
    localStorage.setItem('roletaLosses', losses.toString());
    localStorage.setItem('roletaGreenWins', greenWins.toString());
    const totalSinaisResolvidos = wins + losses;
    const winRate = (totalSinaisResolvidos > 0) ? (wins / totalSinaisResolvidos * 100) : 0;
    if(winRateSpan) {
        // Se o HTML tiver o % (ex: <span id="win-rate">0.00</span>%):
        winRateSpan.textContent = winRate.toFixed(2);
        // Se o HTML NÃO tiver o % (ex: <span id="win-rate">0.00</span>):
        // winRateSpan.textContent = `${winRate.toFixed(2)}%`;
    }
}

/**
 * (Agora não exibe na UI, apenas log opcional ou limpa ul se existir)
 * @param {string[]} cores Array de cores.
 */
function exibirCoresApi(cores) {
    // console.log("Cores recebidas (debug):", cores); // Log opcional
    if (listaCoresApiUl) { // Se o elemento ainda existir no HTML
        listaCoresApiUl.innerHTML = ''; // Limpa para caso seja descomentado
    }
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();
    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI); // Não exibe na UI, mas pode ser usada para debug
        updateStatus("API OK. Monitorando...", false, true); // ✅

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));
        if (ultimoSinal.sinalEsperado) {
            if (dadosDaApiMudaram) {
                verificarResultadoSinal(coresAtuaisAPI[0]);
            }
        }
        if (!ultimoSinal.sinalEsperado) {
             if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
                gerenciarSinais(coresAtuaisAPI);
            }
        }
        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    } else {
        // Erro na API já tratado por updateStatus em obterCoresAPI (mostrará ❌)
        // exibirCoresApi([]); // Já não faz muito
    }

    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
        console.info(`--- Estatísticas Cumulativas (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${wins}, Verdes: ${greenWins}, Erros: ${losses}`);
        const total = wins + losses;
        const taxa = total > 0 ? (wins / total * 100).toFixed(2) : "0.00";
        console.info(`Assertividade: ${taxa}%`);
        console.info(`-------------------------------------------`);
        lastStatsLogTime = agora;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateStatus("Bot Web da Roleta Iniciado.", false, false); // ℹ️
    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now();
    mainLoop();
    setInterval(mainLoop, CHECK_INTERVAL);
});
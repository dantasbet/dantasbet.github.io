// script.js (do seu site no GitHub Pages)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000; // 15 segundos
const CHECK_INTERVAL = 5000; // 5 segundos
const MAX_CORES_API = 20;
const SIGNAL_COOLDOWN = 5000; // 5 segundos de cooldown para o mesmo gatilho
const STATS_INTERVAL = 60 * 10 * 1000; // 10 minutos para logar estatísticas

// --- Global State ---
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,
    timestampGerado: null,
    coresOrigemSinal: null,
    ehMartingale: false // Flag para indicar se ESTE sinal específico é um Martingale
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
let martingaleWins = parseInt(localStorage.getItem('roletaMartingaleWins')) || 0;
let lastStatsLogTime = Date.now();
let aguardandoOportunidadeMartingale = false; // Novo estado para indicar que estamos esperando uma chance de Martingale

// --- DOM Elements Cache ---
const statusDiv = document.getElementById('status');
const sinalTextoP = document.getElementById('sinal-texto');
const winsSpan = document.getElementById('wins');
const greenWinsSpan = document.getElementById('green-wins');
const lossesSpan = document.getElementById('losses');
const winRateSpan = document.getElementById('win-rate');
const casinoIframe = document.getElementById('casino-iframe');
const refreshIframeButton = document.getElementById('refresh-iframe');

// --- Funções ---

function updateStatus(message, isError = false, isSuccess = false) {
    // ... (sem alterações aqui)
    if (statusDiv) {
        let iconClass = 'fa-info-circle';
        let color = 'dodgerblue';
        let titleMessage = `Info: ${message}`;

        if (isError) {
            iconClass = 'fa-times-circle';
            color = 'crimson';
            titleMessage = `Erro: ${message}`;
        } else if (isSuccess) {
            iconClass = 'fa-check-circle';
            color = 'green';
            titleMessage = `Status: ${message}`;
        }
        statusDiv.innerHTML = `<i class="fas ${iconClass}"></i>`;
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
    // ... (sem alterações aqui, usando AbortController)
    console.log("Buscando dados da API via Worker...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(API_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorBody = "Não foi possível ler o corpo do erro.";
            try { errorBody = await response.text(); } catch (e) { /* ignora */ }
            updateStatus(`Erro HTTP ${response.status} via Worker: ${response.statusText}`, true);
            console.error("Corpo da resposta de erro do Worker:", errorBody.substring(0, 500));
            return null;
        }

        const dados = await response.json();

        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida da API (via Worker).", true);
                    return null;
                }
                return coresValidas;
            }
        }
        updateStatus("Formato de dados da API inesperado ou vazio (via Worker).", true);
        return null;
    } catch (error) {
        if (error.name === 'AbortError') {
             updateStatus("Timeout ao buscar dados da API (via Worker).", true);
        } else {
            updateStatus(`ERRO DE FETCH (via Worker): ${error.message}`, true);
        }
        console.error("Detalhes completos do erro (via Worker):", error);
        return null;
    }
}

function verificarPadrao(coresRecentes) {
    // ... (sem alterações aqui)
    if (!coresRecentes || coresRecentes.length === 0) return [null, null, null];
    for (const padraoInfo of PADROES) { // PADROES deve estar definido em padroes.js
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

// MODIFICADO: gerenciarSinais
function gerenciarSinais(coresAtuaisAPI) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado);

        if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
            console.log(`Cooldown para gatilho ${gatilhoStr} ativo. Sinal ignorado.`);
            return false;
        }
        
        const foiResolvidoRecentementeComMesmoGatilhoECores =
            (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
            JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
            JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

        if (foiResolvidoRecentementeComMesmoGatilhoECores) {
            console.log("Gatilho idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado para evitar repetição imediata.");
            return false;
        }

        // Define se o sinal atual é um Martingale
        const esteSinalEhMartingale = aguardandoOportunidadeMartingale;

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: esteSinalEhMartingale // Marca este sinal como Martingale se aplicável
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;

        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        let msgDisplay = `🏹 SINAL IDENTIFICADO\n➡️ Entrar no ${sinalUpper}`;
        let textColor = "var(--accent-color)";

        if (ultimoSinal.ehMartingale) {
            msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--secondary-color)";
        }

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
        
        // Se este sinal foi um Martingale, resetamos o estado de aguardar Martingale
        if (esteSinalEhMartingale) {
            aguardandoOportunidadeMartingale = false;
        }
        return true;
    }
    return false;
}

// MODIFICADO: verificarResultadoSinal
function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return;

    const sinalQueEstavaAtivo = ultimoSinal.sinalEsperado;
    const eraMartingaleEsteSinal = ultimoSinal.ehMartingale; // Verifica se o SINAL ATIVO era um Martingale
    const gatilhoOriginal = ultimoSinal.gatilhoPadrao;
    const coresOrigemDoSinalAtivo = ultimoSinal.coresOrigemSinal;
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";

    let vitoria = false;

    if (novaCorRegistrada === 'verde') {
        msgResultado = eraMartingaleEsteSinal ? "🎯 MARTINGALE GANHO (VERDE)! 🎰" : "🎯 VITÓRIA NO VERDE! 🎰";
        wins++;
        greenWins++;
        if (eraMartingaleEsteSinal) martingaleWins++;
        aguardandoOportunidadeMartingale = false; // Ganhou, reseta Martingale
        vitoria = true;
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalQueEstavaAtivo) {
        msgResultado = eraMartingaleEsteSinal ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        wins++;
        if (eraMartingaleEsteSinal) martingaleWins++;
        aguardandoOportunidadeMartingale = false; // Ganhou, reseta Martingale
        vitoria = true;
        resultadoCorTexto = "var(--success-color)";
    } else { 
        // Perda
        losses++; // Perda sempre é contabilizada
        if (eraMartingaleEsteSinal) { // Perdeu no Martingale
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            aguardandoOportunidadeMartingale = false; // Perdeu o Martingale, fim do ciclo
        } else { // Perdeu no sinal normal
            msgResultado = "❌ ERRO! 👎";
            aguardandoOportunidadeMartingale = true; // Ativa para a PRÓXIMA oportunidade ser um Martingale
            console.log("Derrota no sinal normal. Aguardando oportunidade para Martingale 1...");
        }
        resultadoCorTexto = "var(--danger-color)";
    }

    const statusMsg = `Resultado (${sinalQueEstavaAtivo.toUpperCase()}): ${msgResultado}`;
    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoP.style.color = resultadoCorTexto;
    }
    updateStatus(statusMsg, false, false);

    setTimeout(() => {
        if (!ultimoSinal.sinalEsperado && sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0])) {
            sinalTextoP.innerHTML = `
                <div class="signal-placeholder">
                    <i class="fas fa-spinner fa-pulse"></i>
                    <span>Aguardando sinal...</span>
                </div>`;
            sinalTextoP.style.color = "var(--gray-color)";
        }
    }, 7000);

    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: gatilhoOriginal,
        coresQueFormaramGatilho: coresOrigemDoSinalAtivo ? [...coresOrigemDoSinalAtivo] : null,
        timestampResolvido: Date.now()
    };
    
    // Limpa o sinal atual após ser resolvido, independentemente de martingale ou não.
    // A lógica de `aguardandoOportunidadeMartingale` controlará se o próximo será um martingale.
    ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };

    atualizarEstatisticasDisplay();
}

function atualizarEstatisticasDisplay() {
    // ... (sem alterações aqui)
    if (winsSpan) winsSpan.textContent = wins;
    if (greenWinsSpan) greenWinsSpan.textContent = greenWins;
    if (lossesSpan) lossesSpan.textContent = losses; 

    localStorage.setItem('roletaWins', wins.toString());
    localStorage.setItem('roletaLosses', losses.toString());
    localStorage.setItem('roletaGreenWins', greenWins.toString());
    localStorage.setItem('roletaMartingaleWins', martingaleWins.toString()); 

    const totalSinaisResolvidos = wins + losses;
    const winRate = (totalSinaisResolvidos > 0) ? (wins / totalSinaisResolvidos * 100) : 0;
    if (winRateSpan) {
        winRateSpan.textContent = winRate.toFixed(2); 
    }
}

function exibirCoresApi(cores) {
    // ... (sem alterações aqui)
}

// MODIFICADO: mainLoop
async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        if (statusDiv && !statusDiv.title.startsWith("Erro:")) {
            updateStatus("API OK (via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        // Se existe um sinal ativo e os dados da API mudaram, verifica o resultado.
        if (ultimoSinal.sinalEsperado && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]);
        }
        
        // Tenta gerar um novo sinal APENAS se não houver um sinal ativo.
        // A lógica de ser um Martingale ou não é tratada dentro de `gerenciarSinais`
        // baseado na flag `aguardandoOportunidadeMartingale`.
        if (!ultimoSinal.sinalEsperado && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI);
        }

        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    }

    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
        // ... (log de estatísticas sem alterações)
        console.info(`--- Estatísticas Cumulativas (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${wins}, Verdes: ${greenWins}, Martingale Wins: ${martingaleWins}, Erros: ${losses}`);
        const totalConsiderandoMartingale = wins + losses; 
        const taxa = totalConsiderandoMartingale > 0 ? (wins / totalConsiderandoMartingale * 100).toFixed(2) : "0.00";
        console.info(`Assertividade (considerando MG): ${taxa}%`);
        console.info(`-------------------------------------------`);
        lastStatsLogTime = agora;
    }
}

function zerarEstatisticas() {
    // ... (sem alterações aqui)
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas? Esta ação não pode ser desfeita.")) {
        wins = 0;
        losses = 0;
        greenWins = 0;
        martingaleWins = 0;

        localStorage.removeItem('roletaWins');
        localStorage.removeItem('roletaLosses');
        localStorage.removeItem('roletaGreenWins');
        localStorage.removeItem('roletaMartingaleWins');

        atualizarEstatisticasDisplay();
        console.warn("ESTATÍSTICAS ZERADAS PELO USUÁRIO!");
        updateStatus("Estatísticas zeradas.", false, false);
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (sem alterações aqui)
    if (sinalTextoP && !sinalTextoP.textContent.includes("SINAL IDENTIFICADO") && !sinalTextoP.textContent.includes("MARTINGALE")) {
        sinalTextoP.innerHTML = `
            <div class="signal-placeholder">
                <i class="fas fa-spinner fa-pulse"></i>
                <span>Aguardando sinal...</span>
            </div>`;
        sinalTextoP.style.color = "var(--gray-color)";
    }

    if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i>';
        statusDiv.title = "Bot Web da Roleta Iniciado.";
        statusDiv.style.color = 'dodgerblue';
    } else {
        console.warn("Elemento statusDiv não encontrado.");
    }
    console.log("Bot Web da Roleta Iniciado.");

    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now(); 
    mainLoop(); 
    setInterval(mainLoop, CHECK_INTERVAL); 

    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas(); 
            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                casinoIframe.src = casinoIframe.src; 
                updateStatus("Iframe do cassino atualizado.", false, false);
            }
        });
    } else {
        console.warn("Botão 'refresh-iframe' não encontrado.");
    }
});

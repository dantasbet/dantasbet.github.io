// script.js

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 5000;
const MAX_CORES_API = 20;
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- Global State ---
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,
    timestampGerado: null,
    coresOrigemSinal: null,
    ehMartingale: false
};
let ultimoSinalOriginalPerdido = null; // Para guardar info do sinal que ativou o Martingale
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
let aguardandoOportunidadeMartingale = false;

// --- DOM Elements Cache ---
// ... (sem alterações)
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
    // ... (sem alterações)
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
    // ... (sem alterações)
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
    // ... (sem alterações)
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
    // ... (lógica de cooldowns e geração de ultimoSinal permanece a mesma da versão anterior)
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

        const esteSinalEhMartingale = aguardandoOportunidadeMartingale;

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: esteSinalEhMartingale
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
        
        if (esteSinalEhMartingale) {
            aguardandoOportunidadeMartingale = false; // A tentativa de Martingale está sendo feita
        }
        return true;
    }
    return false;
}

// MODIFICADO SIGNIFICATIVAMENTE: verificarResultadoSinal
function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return;

    const sinalAtual = { ...ultimoSinal }; // Copia para trabalhar, pois ultimoSinal será limpo
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";

    if (novaCorRegistrada === 'verde') {
        wins++; // Green sempre é um win direto
        greenWins++;
        if (sinalAtual.ehMartingale) { // Se o sinal que resultou em verde era um Martingale
            msgResultado = "🎯 MARTINGALE GANHO (VERDE)! 🎰";
            martingaleWins++;
        } else {
            msgResultado = "🎯 VITÓRIA NO VERDE! 🎰";
        }
        aguardandoOportunidadeMartingale = false; // Ganhou, reseta qualquer estado de Martingale
        resultadoCorTexto = "var(--green-color)";

    } else if (novaCorRegistrada === sinalAtual.sinalEsperado) {
        // Acerto na cor esperada
        wins++; // Sempre um win
        if (sinalAtual.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO! ✅";
            martingaleWins++;
        } else {
            msgResultado = "🎯 ACERTO! ✅";
        }
        aguardandoOportunidadeMartingale = false; // Ganhou, reseta qualquer estado de Martingale
        resultadoCorTexto = "var(--success-color)";

    } else {
        // Perda na cor esperada
        if (sinalAtual.ehMartingale) {
            // Perdeu no Martingale: AGORA SIM contabiliza a perda
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++;
            aguardandoOportunidadeMartingale = false; // Ciclo de Martingale falhou
        } else {
            // Perdeu no sinal normal: ativa Martingale, NÃO contabiliza loss ainda
            msgResultado = "❌ ERRO! 👎";
            aguardandoOportunidadeMartingale = true;
            ultimoSinalOriginalPerdido = { ...sinalAtual }; // Guarda info do sinal original
            console.log("Derrota no sinal normal. Aguardando oportunidade para Martingale 1...");
        }
        resultadoCorTexto = "var(--danger-color)";
    }

    const statusMsg = `Resultado (${sinalAtual.sinalEsperado.toUpperCase()}): ${msgResultado}`;
    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoP.style.color = resultadoCorTexto;
    }
    updateStatus(statusMsg, false, false);

    setTimeout(() => {
        // Verifica se o sinalTextoP ainda mostra a mensagem de resultado e se não há um novo sinal ativo
        const placeholderAtivo = sinalTextoP && sinalTextoP.querySelector('.signal-placeholder');
        if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && (!ultimoSinal.sinalEsperado && !placeholderAtivo)) {
             sinalTextoP.innerHTML = `
                <div class="signal-placeholder">
                    <i class="fas fa-spinner fa-pulse"></i>
                    <span>Aguardando sinal...</span>
                </div>`;
            sinalTextoP.style.color = "var(--gray-color)";
        }
    }, 7000);

    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: sinalAtual.gatilhoPadrao,
        coresQueFormaramGatilho: sinalAtual.coresOrigemSinal ? [...sinalAtual.coresOrigemSinal] : null,
        timestampResolvido: Date.now()
    };
    
    ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
    
    // Se o último sinal original perdido ainda estiver guardado (significa que acabamos de entrar em martingale)
    // e não estamos mais aguardando oportunidade (significa que o martingale já foi gerado ou resolvido)
    // então podemos limpar ultimoSinalOriginalPerdido.
    // No entanto, essa variável é mais para debug ou lógicas futuras, a `aguardandoOportunidadeMartingale` é a principal.
    if (ultimoSinalOriginalPerdido && !aguardandoOportunidadeMartingale) {
        ultimoSinalOriginalPerdido = null;
    }

    atualizarEstatisticasDisplay();
}


function atualizarEstatisticasDisplay() {
    // ... (sem alterações)
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
    // ... (sem alterações)
}

async function mainLoop() {
    // ... (lógica permanece a mesma da versão anterior)
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        if (statusDiv && !statusDiv.title.startsWith("Erro:")) {
            updateStatus("API OK (via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if (ultimoSinal.sinalEsperado && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]);
        }
        
        if (!ultimoSinal.sinalEsperado && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI);
        }

        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    }

    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
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
    // ... (sem alterações)
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas? Esta ação não pode ser desfeita.")) {
        wins = 0;
        losses = 0;
        greenWins = 0;
        martingaleWins = 0;
        aguardandoOportunidadeMartingale = false; // Importante resetar o estado de martingale
        ultimoSinalOriginalPerdido = null;      // E o sinal perdido

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
    // ... (sem alterações)
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

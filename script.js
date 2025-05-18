// script.js (Frontend no GitHub Pages - Versão Original Restaurada)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL!
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`; // Corrigido template string

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 5000; // Verificamos a API a cada 5s
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
    ehMartingale: false // Indica se ESTE sinal ativo é uma tentativa de Martingale
};
let sinalOriginalParaMartingale = null; // Guarda o sinal original que falhou e ativou o Martingale
let ultimosGatilhosProcessados = {}; // { "gatilhoJSON": timestamp }
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

// --- Funções ---

function updateStatus(message, isError = false, isSuccess = false) {
    if (statusDiv) {
        let iconClass = 'fa-info-circle';
        let color = 'dodgerblue';
        let titleMessage = `Info: ${message}`; // Corrigido template string

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
        // console.log(message); // Comentado para reduzir verbosidade, pode descomentar para debug
    }
}

async function obterCoresAPI() {
    // console.log("Buscando dados da API via Worker (Onix)..."); // Modificado para clareza
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
            let errorBody = "Não foi possível ler o corpo do erro da resposta do Worker.";
            try { errorBody = await response.text(); } catch (e) { /* ignora */ }
            updateStatus(`Erro HTTP ${response.status} via Worker (Onix): ${response.statusText}`, true);
            console.error("Corpo da resposta de erro do Worker (Onix):", errorBody.substring(0, 500));
            return null;
        }

        const dados = await response.json();

        // Esta parte espera que `identificarCor` esteja definida (de cores_roleta.js)
        // e `PADROES` esteja definido (de padroes.js)
        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor); // `identificarCor` precisa estar disponível
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida retornada pela API (Onix).", true);
                    return null;
                }
                return coresValidas;
            }
        }
        updateStatus("Formato de dados da API (Onix) inesperado ou vazio.", true);
        return null;
    } catch (error) {
        if (error.name === 'AbortError') {
             updateStatus("Timeout ao buscar dados da API (Onix) via Worker.", true);
        } else {
            updateStatus(`ERRO DE FETCH ao contatar o Worker (Onix): ${error.message}`, true);
        }
        console.error("Detalhes completos do erro de fetch (Worker, Onix):", error);
        return null;
    }
}

function verificarPadrao(coresRecentes) {
    if (!coresRecentes || coresRecentes.length === 0) return [null, null, null];

    // Esta função requer que a variável `PADROES` esteja definida e acessível.
    // Certifique-se de que padroes.js está incluído no seu HTML e `PADROES` está global.
    if (typeof PADROES === 'undefined') {
        console.error("A variável PADROES não está definida. Verifique se padroes.js está carregado.");
        return [null, null, null];
    }

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
                console.info("PADRÃO GATILHO ENCONTRADO:", JSON.stringify(sequenciaPadrao), "SINAL GERADO:", padraoInfo.sinal);
                return [padraoInfo.sinal, sequenciaPadrao, coresRecentes.slice(0, sequenciaPadrao.length)];
            }
        }
    }
    return [null, null, null];
}

function gerenciarSinais(coresAtuaisAPI, forcarMartingale = false) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado); // Padrões fixos são arrays, JSON.stringify é adequado

        if (!forcarMartingale) {
            if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
                console.log(`Cooldown para gatilho ${gatilhoStr} ativo. Sinal ignorado.`);
                return false;
            }
            const foiResolvidoRecentementeComMesmoGatilhoECores =
                (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
                JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
                JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

            if (foiResolvidoRecentementeComMesmoGatilhoECores) {
                console.log("Gatilho idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado.");
                return false;
            }
        }

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado, // Array do padrão
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: forcarMartingale
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;

        if (forcarMartingale) {
            sinalOriginalParaMartingale = null;
        }

        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        let msgDisplay;
        let textColor;

        if (ultimoSinal.ehMartingale) {
            msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--secondary-color)";
        } else {
            msgDisplay = `🏹 SINAL IDENTIFICADO\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--accent-color)";
        }

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace(/\n/g, '<br>'); // Usar replace com regex global
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
        return true;
    }
    return false;
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale) {
        return;
    }

    if (sinalOriginalParaMartingale) {
        // console.log("API atualizou após falha de sinal normal. Tentando gerar Martingale...");
        const martingaleGerado = gerenciarSinais(ultimosRegistradosAPI, true);
        if (martingaleGerado) {
            return;
        } else {
            if (sinalTextoP && !sinalTextoP.innerHTML.includes("MARTINGALE")) {
                 sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                 sinalTextoP.style.color = "var(--warning-color)";
            }
            // console.log("Nenhum padrão encontrado para o Martingale 1. Aguardando próxima rodada...");
            return;
        }
    }

    const sinalResolvido = { ...ultimoSinal };
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";
    let cicloEncerrado = true;

    if (novaCorRegistrada === 'verde') {
        wins++;
        greenWins++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO (VERDE)! 🎰";
            martingaleWins++;
        } else {
            msgResultado = "🎯 VITÓRIA NO VERDE! 🎰";
        }
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        wins++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO! ✅";
            martingaleWins++;
        } else {
            msgResultado = "🎯 ACERTO! ✅";
        }
        resultadoCorTexto = "var(--success-color)";
    } else {
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++;
            resultadoCorTexto = "var(--danger-color)";
        } else {
            sinalOriginalParaMartingale = { ...sinalResolvido };
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            cicloEncerrado = false;
            // console.log(`Falha no sinal normal (${sinalOriginalParaMartingale.sinalEsperado}). Tentando Martingale 1...`);
            const martingaleGeradoAgora = gerenciarSinais(ultimosRegistradosAPI, true);
            if (martingaleGeradoAgora) {
                return;
            } else {
                if (sinalTextoP) {
                    sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                    sinalTextoP.style.color = "var(--warning-color)";
                }
                // console.log("Nenhum padrão para Martingale 1 encontrado imediatamente. Aguardando...");
                return;
            }
        }
    }

    if (cicloEncerrado) {
        const statusMsg = `Resultado do sinal (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado}`;
        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
            sinalTextoP.style.color = resultadoCorTexto;
        }
        updateStatus(statusMsg, false, (msgResultado.includes("VITÓRIA") || msgResultado.includes("ACERTO") || msgResultado.includes("GANHO")));


        setTimeout(() => {
            const placeholderAtivo = sinalTextoP && sinalTextoP.querySelector('.signal-placeholder');
            if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal.sinalEsperado && !placeholderAtivo ) {
                 sinalTextoP.innerHTML = `
                    <div class="signal-placeholder">
                        <i class="fas fa-spinner fa-pulse"></i>
                        <span>Aguardando sinal...</span>
                    </div>`;
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

    const totalSinaisResolvidos = wins + losses;
    const winRate = (totalSinaisResolvidos > 0) ? (wins / totalSinaisResolvidos * 100) : 0;
    if (winRateSpan) {
        winRateSpan.textContent = winRate.toFixed(2) + "%"; // Adicionado o % aqui
    }
}

function exibirCoresApi(cores) {
    // console.log("Cores da API (Onix):", cores); // Exibe as cores recebidas
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        // exibirCoresApi(coresAtuaisAPI); // Descomente para logar
        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !sinalOriginalParaMartingale && !ultimoSinal.sinalEsperado) {
             updateStatus("API OK (Onix via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if ((ultimoSinal.sinalEsperado || sinalOriginalParaMartingale) && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]);
        }
        
        if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI, false);
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
        console.info(`Assertividade (considerando ciclos com MG1): ${taxa}%`);
        console.info(`-------------------------------------------`);
        lastStatsLogTime = agora;
    }
}

function zerarEstatisticas() {
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas? Esta ação não pode ser desfeita.")) {
        wins = 0;
        losses = 0;
        greenWins = 0;
        martingaleWins = 0;
        sinalOriginalParaMartingale = null;
        ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
        ultimosGatilhosProcessados = {};
        ultimoSinalResolvidoInfo = { gatilhoPadrao: null, coresQueFormaramGatilho: null, timestampResolvido: 0 };

        localStorage.removeItem('roletaWins');
        localStorage.removeItem('roletaLosses');
        localStorage.removeItem('roletaGreenWins');
        localStorage.removeItem('roletaMartingaleWins');

        atualizarEstatisticasDisplay();
         if (sinalTextoP) { // Volta para o placeholder
            sinalTextoP.innerHTML = `
                <div class="signal-placeholder">
                    <i class="fas fa-spinner fa-pulse"></i>
                    <span>Aguardando sinal...</span>
                </div>`;
            sinalTextoP.style.color = "var(--gray-color)";
        }
        console.warn("ESTATÍSTICAS ZERADAS PELO USUÁRIO!");
        updateStatus("Estatísticas zeradas.", false, false);
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
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
        statusDiv.title = "Bot Web da Roleta (Onix API) Iniciado."; // Atualizado título
        statusDiv.style.color = 'dodgerblue';
    } else {
        console.warn("Elemento statusDiv não encontrado no DOM.");
    }
    console.log("Bot Web da Roleta (Onix API) Iniciado.");

    atualizarEstatisticasDisplay(); 
    lastStatsLogTime = Date.now(); 
    mainLoop(); 
    setInterval(mainLoop, CHECK_INTERVAL); 

    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas(); 
            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                const currentSrc = casinoIframe.src;
                casinoIframe.src = 'about:blank'; // Força descarregamento
                setTimeout(() => { casinoIframe.src = currentSrc; }, 100); // Recarrega
                updateStatus("Iframe do cassino atualizado e estatísticas zeradas.", false, false);
            }
        });
    } else {
        console.warn("Botão 'refresh-iframe' não encontrado no DOM.");
    }
});

// script.js

// --- Configuration ---
// ... (sem alterações aqui)
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const API_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET_API_URL)}`;
const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 3000;
const MAX_CORES_API = 20;
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- Global State ---
// ... (sem alterações aqui)
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null,
    timestampGerado: null,
    coresOrigemSinal: null,
    ehMartingale: false
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
let emMartingale = false;

// --- DOM Elements Cache ---
// ... (sem alterações aqui)
const statusDiv = document.getElementById('status');
const sinalTextoP = document.getElementById('sinal-texto');
const winsSpan = document.getElementById('wins');
const greenWinsSpan = document.getElementById('green-wins');
const lossesSpan = document.getElementById('losses');
const winRateSpan = document.getElementById('win-rate');
const casinoIframe = document.getElementById('casino-iframe'); // Cache do iframe
const refreshIframeButton = document.getElementById('refresh-iframe'); // Cache do botão de refresh

// --- Funções ---
// ... (updateStatus, obterCoresAPI, verificarPadrao, gerenciarSinais, verificarResultadoSinal, exibirCoresApi, mainLoop - permanecem como na última versão)

function updateStatus(message, isError = false, isSuccess = false) {
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
    console.log("Buscando dados da API...");
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
            console.log(`Cooldown para gatilho ${gatilhoStr} ativo. Sinal ignorado.`);
            return false;
        }
        
        const foiResolvidoRecentementeComMesmoGatilho = 
            (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
            JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
            JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

        if (foiResolvidoRecentementeComMesmoGatilho) {
            console.log("Gatilho idêntico resolvido recentemente. Sinal ignorado para evitar repetição imediata.");
            return false;
        }

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: emMartingale 
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;

        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        let msgDisplay = `🏹 SINAL IDENTIFICADO\n➡️ Entrar no ${sinalUpper}`;
        let textColor = "var(--accent-color)"; // Usar variável CSS

        if (ultimoSinal.ehMartingale) {
            msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--secondary-color)"; // Usar variável CSS
        }

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
        
        emMartingale = false; 
        return true;
    }
    return false;
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return;

    const sinalQueEstavaAtivo = ultimoSinal.sinalEsperado;
    const eraMartingale = ultimoSinal.ehMartingale;
    const gatilhoOriginal = ultimoSinal.gatilhoPadrao;
    const coresOrigemDoSinalAtivo = ultimoSinal.coresOrigemSinal;
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)"; // Usar variável CSS

    if (novaCorRegistrada === 'verde') {
        msgResultado = eraMartingale ? "🎯 MARTINGALE GANHO (VERDE)! 🎰" : "🎯 VITÓRIA NO VERDE! 🎰";
        wins++;
        greenWins++;
        if (eraMartingale) martingaleWins++;
        emMartingale = false; 
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalQueEstavaAtivo) {
        msgResultado = eraMartingale ? "🎯 MARTINGALE GANHO! ✅" : "🎯 ACERTO! ✅";
        wins++;
        if (eraMartingale) martingaleWins++;
        emMartingale = false; 
        resultadoCorTexto = "var(--success-color)";
    } else { 
        if (eraMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++; 
            emMartingale = false; 
        } else {
            msgResultado = "❌ ERRO! 👎";
            emMartingale = true;
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
    
    if (!emMartingale || eraMartingale) {
        ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
    } else {
        console.log("Esperando oportunidade para Martingale 1...");
    }

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

    const totalSinaisResolvidos = wins + losses;
    const winRate = (totalSinaisResolvidos > 0) ? (wins / totalSinaisResolvidos * 100) : 0;
    if (winRateSpan) {
        winRateSpan.textContent = winRate.toFixed(2); 
    }
}

function exibirCoresApi(cores) {
    // console.log("Cores da API:", cores);
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        if (statusDiv && !statusDiv.title.startsWith("Erro:")) { // Verifica se statusDiv existe
            updateStatus("API OK. Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if (ultimoSinal.sinalEsperado) { 
            if (dadosDaApiMudaram) {
                verificarResultadoSinal(coresAtuaisAPI[0]);
            }
        }
        
        if ((!ultimoSinal.sinalEsperado && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) ||
            (emMartingale && !ultimoSinal.ehMartingale) ) {
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

// MODIFICAÇÃO: Função para zerar estatísticas
function zerarEstatisticas() {
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
        updateStatus("Estatísticas zeradas.", false, false); // Informativo
    }
}


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

    // MODIFICAÇÃO: Adicionar listener ao botão de refresh
    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            // 1. Pergunta se quer zerar estatísticas ANTES de atualizar o iframe
            //    Ou podemos ter dois comportamentos: clique simples atualiza, clique longo/direito zera.
            //    Para simplicidade, vamos fazer com que ele pergunte sempre.
            //    Ou melhor: vamos adicionar um SEGUNDO botão ou um comportamento diferente.
            //    Por ora, vamos adicionar a opção de zerar E depois atualizar.
            
            // Ação de zerar estatísticas (pode ser condicional)
            // Por simplicidade, vamos fazer com que o clique agora dispare a pergunta de zerar
            // E MANTENHA a atualização do iframe.
            zerarEstatisticas(); // Chama a função que pergunta e zera se confirmado

            // Ação de atualizar o iframe (continua existindo)
            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                casinoIframe.src = casinoIframe.src; // Recarrega o iframe
                updateStatus("Iframe do cassino atualizado.", false, false);
            }
        });
    } else {
        console.warn("Botão 'refresh-iframe' não encontrado.");
    }
});

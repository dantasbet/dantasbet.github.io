// script.js (do seu site no GitHub Pages)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
// SUBSTITUA PELA URL COMPLETA DO SEU CLOUDFLARE WORKER:
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/';
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
    ehMartingale: false
};
let ultimosGatilhosProcessados = {}; // Para cooldown de gatilhos específicos
let ultimoSinalResolvidoInfo = {    // Para evitar repetição imediata do mesmo sinal resolvido
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null,
    timestampResolvido: 0
};
let wins = parseInt(localStorage.getItem('roletaWins')) || 0;
let losses = parseInt(localStorage.getItem('roletaLosses')) || 0;
let greenWins = parseInt(localStorage.getItem('roletaGreenWins')) || 0;
let martingaleWins = parseInt(localStorage.getItem('roletaMartingaleWins')) || 0;
let lastStatsLogTime = Date.now();
let emMartingale = false; // Estado global para Martingale

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
    console.log("Buscando dados da API via Worker...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(API_URL, {
            method: 'GET',
            cache: 'no-store', // Evita cache do navegador para dados da API
            signal: controller.signal
        });

        clearTimeout(timeoutId); // Limpa o timeout se a requisição completar a tempo

        if (!response.ok) {
            let errorBody = "Não foi possível ler o corpo do erro.";
            try { errorBody = await response.text(); } catch (e) { /* ignora */ }
            updateStatus(`Erro HTTP ${response.status} via Worker: ${response.statusText}`, true);
            console.error("Corpo da resposta de erro do Worker:", errorBody.substring(0, 500));
            return null;
        }

        const dados = await response.json(); // Resposta direta do Worker

        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida da API (via Worker).", true);
                    return null;
                }
                // Se chegou aqui e não houve erro antes, pode atualizar status de sucesso
                // if (statusDiv && !statusDiv.title.startsWith("Erro:")) {
                //     updateStatus("API OK (via Worker). Monitorando...", false, true);
                // }
                return coresValidas;
            }
        }
        updateStatus("Formato de dados da API inesperado ou vazio (via Worker).", true);
        return null;
    } catch (error) {
        if (error.name === 'AbortError') { // Erro de timeout do AbortController
             updateStatus("Timeout ao buscar dados da API (via Worker).", true);
        } else {
            updateStatus(`ERRO DE FETCH (via Worker): ${error.message}`, true);
        }
        console.error("Detalhes completos do erro (via Worker):", error);
        return null;
    }
}

function verificarPadrao(coresRecentes) {
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

function gerenciarSinais(coresAtuaisAPI) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado);

        // Cooldown para o mesmo padrão gatilho
        if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
            console.log(`Cooldown para gatilho ${gatilhoStr} ativo. Sinal ignorado.`);
            return false;
        }
        
        // Cooldown para evitar repetição imediata do mesmo sinal resolvido (mesmo gatilho e mesmas cores de origem)
        const foiResolvidoRecentementeComMesmoGatilhoECores =
            (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
            JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
            JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

        if (foiResolvidoRecentementeComMesmoGatilhoECores) {
            console.log("Gatilho idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado para evitar repetição imediata.");
            return false;
        }

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora], // Armazena as cores exatas que formaram o gatilho
            ehMartingale: emMartingale // Se emMartingale global for true, este sinal será um martingale
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora; // Atualiza timestamp do último processamento deste gatilho

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
        
        emMartingale = false; // Reseta o estado de martingale global após gerar o sinal (seja ele normal ou martingale)
        return true;
    }
    return false;
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return;

    const sinalQueEstavaAtivo = ultimoSinal.sinalEsperado;
    const eraMartingale = ultimoSinal.ehMartingale;
    const gatilhoOriginal = ultimoSinal.gatilhoPadrao; // Gatilho que gerou o sinal (normal ou martingale)
    const coresOrigemDoSinalAtivo = ultimoSinal.coresOrigemSinal; // Cores que formaram o gatilho
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";

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
        // Perda
        if (eraMartingale) { // Se perdeu no Martingale
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++; 
            emMartingale = false; // Fim do ciclo de Martingale
        } else { // Se perdeu no sinal normal, ativa o Martingale para a próxima oportunidade
            msgResultado = "❌ ERRO! 👎";
            losses++; // Contabiliza a perda do sinal normal
            emMartingale = true; // Ativa o estado para o próximo sinal ser um Martingale
        }
        resultadoCorTexto = "var(--danger-color)";
    }

    const statusMsg = `Resultado (${sinalQueEstavaAtivo.toUpperCase()}): ${msgResultado}`;
    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoP.style.color = resultadoCorTexto;
    }
    updateStatus(statusMsg, false, false);

    // Limpa a mensagem de resultado após um tempo se nenhum novo sinal foi gerado
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

    // Registra informações do sinal que acabou de ser resolvido para o cooldown de repetição
    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: gatilhoOriginal,
        coresQueFormaramGatilho: coresOrigemDoSinalAtivo ? [...coresOrigemDoSinalAtivo] : null,
        timestampResolvido: Date.now()
    };
    
    // Limpa o ultimoSinal se não estivermos entrando em martingale, ou se o martingale já foi resolvido.
    if (!emMartingale || eraMartingale) { // Se não estamos esperando martingale OU se este era um martingale
        ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
    } else {
        // Se emMartingale é true E não eraMartingale (ou seja, acabamos de perder um sinal normal e ativamos o martingale)
        // Não limpa ultimoSinal completamente ainda, pois a lógica de martingale pode precisar dele,
        // mas a flag ehMartingale já está em ultimoSinal e será usada por gerenciarSinais.
        // A lógica de gerenciarSinais vai definir ultimoSinal.ehMartingale = true quando gerar o sinal de martingale.
        // No entanto, é mais seguro resetar parcialmente e deixar gerenciarSinais construir o novo.
        ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
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
    // Função para exibir as cores no HTML, se necessário (não implementado visualmente)
    // console.log("Cores da API para display:", cores);
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI); // Pode ser usado para mostrar as bolinhas coloridas
        if (statusDiv && !statusDiv.title.startsWith("Erro:")) {
            updateStatus("API OK (via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if (ultimoSinal.sinalEsperado) { 
            if (dadosDaApiMudaram) {
                verificarResultadoSinal(coresAtuaisAPI[0]); // Verifica resultado com a cor MAIS RECENTE
            }
        }
        
        // Condições para gerar um novo sinal:
        // 1. Não há sinal ativo E (os dados da API mudaram OU é a primeira vez)
        // OU
        // 2. Estamos em estado de Martingale (emMartingale global = true) E o último sinal não foi marcado como martingale
        //    (isso garante que gerenciarSinais seja chamado para tentar gerar um sinal de martingale)
        if ((!ultimoSinal.sinalEsperado && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) ||
            (emMartingale && !ultimoSinal.ehMartingale) ) { // A flag ehMartingale em ultimoSinal só é true quando o SINAL DE MARTINGALE é gerado
            gerenciarSinais(coresAtuaisAPI);
        }

        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    } else {
        // Se obterCoresAPI retornou null, o updateStatus de erro já foi chamado dentro dela.
        // Podemos manter o status de erro anterior ou definir um novo se necessário.
    }

    // Log de estatísticas periódicas
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
    // Configuração inicial do texto do sinal
    if (sinalTextoP && !sinalTextoP.textContent.includes("SINAL IDENTIFICADO") && !sinalTextoP.textContent.includes("MARTINGALE")) {
        sinalTextoP.innerHTML = `
            <div class="signal-placeholder">
                <i class="fas fa-spinner fa-pulse"></i>
                <span>Aguardando sinal...</span>
            </div>`;
        sinalTextoP.style.color = "var(--gray-color)";
    }

    // Configuração inicial do status
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
    mainLoop(); // Chama uma vez para buscar dados imediatamente
    setInterval(mainLoop, CHECK_INTERVAL); 

    // Listener para o botão de refresh do iframe
    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            // Pergunta se quer zerar estatísticas antes de atualizar
            // Para simplificar, vamos apenas zerar se confirmado E depois atualizar
            zerarEstatisticas(); // Pergunta e zera se confirmado

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

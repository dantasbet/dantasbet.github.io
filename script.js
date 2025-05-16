// script.js (Frontend no GitHub Pages)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL!
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000; // 15 segundos
const CHECK_INTERVAL = 5000; // 5 segundos
const MAX_CORES_API = 20; // Máximo de cores a processar da API
const SIGNAL_COOLDOWN = 5000; // 5 segundos de cooldown para o mesmo gatilho e para repetição de sinal resolvido
const STATS_INTERVAL = 60 * 10 * 1000; // 10 minutos para logar estatísticas no console

// --- Global State ---
let ultimosRegistradosAPI = []; // Últimas cores válidas recebidas da API
let ultimoSinal = { // Informações sobre o sinal atualmente ativo ou o último gerado
    sinalEsperado: null,    // Cor esperada ('vermelho', 'preto')
    gatilhoPadrao: null,    // Array da sequência de cores que gerou o sinal
    timestampGerado: null,  // Quando o sinal foi gerado
    coresOrigemSinal: null, // Cópia das cores exatas da API que formaram o gatilho
    ehMartingale: false     // Se ESTE sinal é uma tentativa de Martingale
};
let ultimosGatilhosProcessados = {}; // Objeto para rastrear o timestamp do último processamento de cada gatilho (para cooldown)
let ultimoSinalResolvidoInfo = {    // Informações sobre o último sinal resolvido (para cooldown de repetição)
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null,
    timestampResolvido: 0
};

// Estatísticas
let wins = parseInt(localStorage.getItem('roletaWins')) || 0;
let losses = parseInt(localStorage.getItem('roletaLosses')) || 0;
let greenWins = parseInt(localStorage.getItem('roletaGreenWins')) || 0;
let martingaleWins = parseInt(localStorage.getItem('roletaMartingaleWins')) || 0; // Wins que vieram de uma entrada de Martingale
let lastStatsLogTime = Date.now(); // Para log periódico de estatísticas

// Controle de Martingale
let aguardandoOportunidadeMartingale = false; // true se um sinal normal perdeu e estamos esperando chance para o Martingale 1

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
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorBody = "Não foi possível ler o corpo do erro da resposta do Worker.";
            try { errorBody = await response.text(); } catch (e) { /* ignora */ }
            updateStatus(`Erro HTTP ${response.status} via Worker: ${response.statusText}`, true);
            console.error("Corpo da resposta de erro do Worker:", errorBody.substring(0, 500));
            return null;
        }

        const dados = await response.json();

        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor); // identificarCor de cores_roleta.js
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida retornada pela API (via Worker).", true);
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
            updateStatus(`ERRO DE FETCH ao contatar o Worker: ${error.message}`, true);
        }
        console.error("Detalhes completos do erro de fetch (Worker):", error);
        return null;
    }
}

function verificarPadrao(coresRecentes) {
    if (!coresRecentes || coresRecentes.length === 0) return [null, null, null];

    for (const padraoInfo of PADROES) { // PADROES de padroes.js
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
                // Padrão encontrado, retorna [sinal, padrão que ativou, cores que formaram o padrão]
                console.info("PADRÃO GATILHO ENCONTRADO:", JSON.stringify(sequenciaPadrao), "SINAL GERADO:", padraoInfo.sinal);
                return [padraoInfo.sinal, sequenciaPadrao, coresRecentes.slice(0, sequenciaPadrao.length)];
            }
        }
    }
    return [null, null, null]; // Nenhum padrão encontrado
}

function gerenciarSinais(coresAtuaisAPI) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado); // Chave para cooldowns

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
            console.log("Gatilho idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado.");
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
        ultimosGatilhosProcessados[gatilhoStr] = agora; // Atualiza timestamp do último processamento deste gatilho

        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        let msgDisplay = `🏹 SINAL IDENTIFICADO\n➡️ Entrar no ${sinalUpper}`;
        let textColor = "var(--accent-color)"; // Cor padrão para sinal normal

        if (ultimoSinal.ehMartingale) {
            msgDisplay = `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--secondary-color)"; // Cor para Martingale
        }

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove(); // Remove o placeholder "Aguardando sinal..."
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
        
        // Se este sinal foi um Martingale, resetamos a flag global, pois a tentativa está sendo feita.
        if (esteSinalEhMartingale) {
            aguardandoOportunidadeMartingale = false;
        }
        return true; // Sinal gerado
    }
    return false; // Nenhum sinal gerado
}

function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado) return; // Não há sinal ativo para verificar

    const sinalResolvido = { ...ultimoSinal }; // Copia para preservar o estado do sinal que está sendo resolvido
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)"; // Cor padrão para resultado

    if (novaCorRegistrada === 'verde') {
        wins++;
        greenWins++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO (VERDE)! 🎰";
            martingaleWins++;
        } else {
            msgResultado = "🎯 VITÓRIA NO VERDE! 🎰";
        }
        aguardandoOportunidadeMartingale = false; // Vitória reseta a necessidade de Martingale
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        // Acertou a cor prevista
        wins++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO! ✅";
            martingaleWins++;
        } else {
            msgResultado = "🎯 ACERTO! ✅";
        }
        aguardandoOportunidadeMartingale = false; // Vitória reseta a necessidade de Martingale
        resultadoCorTexto = "var(--success-color)";
    } else {
        // Errou a cor prevista
        if (sinalResolvido.ehMartingale) {
            // Perdeu no Martingale
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++; // Contabiliza a perda
            aguardandoOportunidadeMartingale = false; // Ciclo de Martingale falhou, reseta
        } else {
            // Perdeu no sinal normal
            msgResultado = "❌ ERRO! 👎";
            // NÃO contabiliza 'losses' ainda, ativa o Martingale para a próxima oportunidade
            aguardandoOportunidadeMartingale = true;
            console.log(`Derrota no sinal (${sinalResolvido.sinalEsperado}). Aguardando Martingale 1...`);
        }
        resultadoCorTexto = "var(--danger-color)";
    }

    const statusMsg = `Resultado do sinal (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado}`;
    if (sinalTextoP) {
        sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
        sinalTextoP.style.color = resultadoCorTexto;
    }
    updateStatus(statusMsg, false, false);

    // Limpa a mensagem de resultado após um tempo, se nenhum novo sinal for gerado
    setTimeout(() => {
        const placeholderAtivo = sinalTextoP && sinalTextoP.querySelector('.signal-placeholder');
        // Verifica se a mensagem atual é a de resultado e se não há novo sinal ou placeholder já ativo
        if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal.sinalEsperado && !placeholderAtivo) {
             sinalTextoP.innerHTML = `
                <div class="signal-placeholder">
                    <i class="fas fa-spinner fa-pulse"></i>
                    <span>Aguardando sinal...</span>
                </div>`;
            sinalTextoP.style.color = "var(--gray-color)";
        }
    }, 7000); // Tempo para exibir o resultado antes de limpar

    // Registra informações do sinal que acabou de ser resolvido (para cooldown de repetição)
    ultimoSinalResolvidoInfo = {
        gatilhoPadrao: sinalResolvido.gatilhoPadrao,
        coresQueFormaramGatilho: sinalResolvido.coresOrigemSinal ? [...sinalResolvido.coresOrigemSinal] : null,
        timestampResolvido: Date.now()
    };
    
    // Limpa o sinal atual, pois ele já foi processado.
    // A flag `aguardandoOportunidadeMartingale` controlará se o próximo sinal será um Martingale.
    ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };

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
    // Esta função pode ser usada para exibir as últimas cores da API no HTML,
    // por exemplo, como uma sequência de bolinhas coloridas.
    // console.log("Cores da API para display:", cores);
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        // Atualiza o status para "API OK" apenas se não houver um erro já exibido
        if (statusDiv && !statusDiv.title.startsWith("Erro:")) {
            updateStatus("API OK (via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        // Se existe um sinal ativo e os dados da API mudaram, verifica o resultado.
        if (ultimoSinal.sinalEsperado && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]); // Usa a cor MAIS RECENTE para verificar resultado
        }
        
        // Tenta gerar um novo sinal APENAS se não houver um sinal ativo.
        // A lógica de ser um Martingale ou não é tratada dentro de `gerenciarSinais`
        // com base na flag global `aguardandoOportunidadeMartingale`.
        if (!ultimoSinal.sinalEsperado && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI);
        }

        // Atualiza o registro das últimas cores se houve mudança ou se é a primeira vez
        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    }
    // Se `coresAtuaisAPI` for null, `obterCoresAPI` já chamou `updateStatus` com erro.

    // Log de estatísticas periódicas no console
    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
        console.info(`--- Estatísticas Cumulativas (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${wins}, Verdes: ${greenWins}, Martingale Wins: ${martingaleWins}, Erros: ${losses}`);
        const totalConsiderandoMartingale = wins + losses; // Total de ciclos de aposta (sinal normal ou sinal+martingale)
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
        aguardandoOportunidadeMartingale = false; // Importante resetar o estado de Martingale

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
        console.warn("Elemento statusDiv não encontrado no DOM.");
    }
    console.log("Bot Web da Roleta Iniciado.");

    atualizarEstatisticasDisplay(); // Carrega estatísticas salvas ou inicia com zero
    lastStatsLogTime = Date.now(); 
    mainLoop(); // Chama uma vez para buscar dados imediatamente ao carregar
    setInterval(mainLoop, CHECK_INTERVAL); // Inicia o loop principal de monitoramento

    // Listener para o botão de refresh do iframe
    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas(); // Pergunta e zera se confirmado

            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                casinoIframe.src = casinoIframe.src; // Recarrega o iframe
                updateStatus("Iframe do cassino atualizado.", false, false);
            }
        });
    } else {
        console.warn("Botão 'refresh-iframe' não encontrado no DOM.");
    }
});

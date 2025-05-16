// script.js (Frontend no GitHub Pages)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/237';
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL!
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

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

// --- DOM Elements Cache ---
const statusDiv = document.getElementById('status');
const sinalTextoP = document.getElementById('sinal-texto');
const winsSpan = document.getElementById('wins');
// ... (resto dos caches DOM)
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
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
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
                console.info("PADRÃO GATILHO ENCONTRADO:", JSON.stringify(sequenciaPadrao), "SINAL GERADO:", padraoInfo.sinal);
                return [padraoInfo.sinal, sequenciaPadrao, coresRecentes.slice(0, sequenciaPadrao.length)];
            }
        }
    }
    return [null, null, null];
}

// MODIFICADO: gerenciarSinais
function gerenciarSinais(coresAtuaisAPI, forcarMartingale = false) {
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadrao(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado);

        if (!forcarMartingale) { // Cooldowns não se aplicam se estamos forçando um martingale
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
            sinalEsperado: sinalDetectado, // O sinal do padrão encontrado
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: forcarMartingale // Marcamos como Martingale se forcarMartingale for true
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;

        // Se um sinal de martingale foi gerado, limpamos a flag de sinal original perdido
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
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
        return true;
    }
    return false;
}

// MODIFICADO SIGNIFICATIVAMENTE: verificarResultadoSinal
function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale) {
        // Não há sinal ativo nem estamos esperando resolver um Martingale indiretamente
        return;
    }

    // Se sinalOriginalParaMartingale existe, significa que um sinal normal falhou
    // e estamos APENAS esperando a API atualizar para TENTAR gerar o sinal de Martingale.
    // Neste ponto, NÃO processamos o resultado do sinal original ainda.
    if (sinalOriginalParaMartingale) {
        console.log("API atualizou após falha de sinal normal. Tentando gerar Martingale...");
        // Chamamos gerenciarSinais forçando Martingale. Se ele encontrar um padrão,
        // ele definirá ultimoSinal.ehMartingale = true e limpará sinalOriginalParaMartingale.
        // Se não encontrar padrão, sinalOriginalParaMartingale permanece e tentaremos na próxima atualização da API.
        const martingaleGerado = gerenciarSinais(ultimosRegistradosAPI, true); // Usa as cores que já temos
        if (martingaleGerado) {
            // Martingale foi gerado e está ativo em ultimoSinal.
            // Agora esperamos a PRÓXIMA atualização da API para resolver ESTE sinal de Martingale.
            return; // Sai para esperar o resultado do Martingale
        } else {
            // Não encontrou padrão para o Martingale ainda, continua aguardando.
            // Exibe uma mensagem de espera se ainda não estiver exibindo uma de Martingale.
            if (sinalTextoP && !sinalTextoP.innerHTML.includes("MARTINGALE")) {
                 sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                 sinalTextoP.style.color = "var(--warning-color)"; // Uma cor de aviso
            }
            console.log("Nenhum padrão encontrado para o Martingale 1. Aguardando próxima rodada...");
            return; // Sai e espera a próxima atualização da API
        }
    }

    // Se chegamos aqui, é porque ultimoSinal está ativo (seja normal ou Martingale)
    // e não estamos no estado intermediário de `sinalOriginalParaMartingale`.
    const sinalResolvido = { ...ultimoSinal }; // Copia o sinal ativo para resolução
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";
    let cicloEncerrado = true; // Assume que o ciclo (sinal ou sinal+MG) se encerra

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
        // Errou a cor prevista
        if (sinalResolvido.ehMartingale) {
            // Perdeu no Martingale
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++; // Contabiliza a perda do ciclo
            resultadoCorTexto = "var(--danger-color)";
        } else {
            // Perdeu no sinal normal -> Prepara para Martingale
            // NÃO exibe "ERRO" como resultado final ainda.
            // A mensagem de Martingale será exibida por gerenciarSinais.
            sinalOriginalParaMartingale = { ...sinalResolvido }; // Guarda o sinal que falhou
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false }; // Limpa o sinal ativo
            cicloEncerrado = false; // O ciclo não encerrou, vai para Martingale

            // Tenta gerar o Martingale imediatamente com as cores atuais da API
            console.log(`Falha no sinal normal (${sinalOriginalParaMartingale.sinalEsperado}). Tentando Martingale 1...`);
            const martingaleGeradoAgora = gerenciarSinais(ultimosRegistradosAPI, true);
            if (martingaleGeradoAgora) {
                // Martingale foi gerado, a mensagem já foi exibida por gerenciarSinais.
                // Retornamos para esperar o resultado do Martingale na próxima rodada.
                return;
            } else {
                // Não encontrou padrão para Martingale imediatamente.
                // Exibe mensagem de espera. `sinalOriginalParaMartingale` ainda está setado.
                if (sinalTextoP) {
                    sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                    sinalTextoP.style.color = "var(--warning-color)";
                }
                console.log("Nenhum padrão para Martingale 1 encontrado imediatamente. Aguardando...");
                return; // Retorna para esperar a próxima atualização da API
            }
        }
    }

    // Se o ciclo foi encerrado (ganhou, ou perdeu no martingale)
    if (cicloEncerrado) {
        const statusMsg = `Resultado do sinal (${sinalResolvido.sinalEsperado.toUpperCase()}): ${msgResultado}`;
        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgResultado.replace(/\n/g, '<br>');
            sinalTextoP.style.color = resultadoCorTexto;
        }
        updateStatus(statusMsg, false, false);

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
        sinalOriginalParaMartingale = null; // Limpa se houver algo
        atualizarEstatisticasDisplay();
    }
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

// MODIFICADO: mainLoop
async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !sinalOriginalParaMartingale && !ultimoSinal.sinalEsperado) {
            // Só mostra "API OK Monitorando" se não estivermos esperando martingale ou com sinal ativo
             updateStatus("API OK (via Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        // Se um sinal (normal ou Martingale) está ativo E os dados mudaram, verifica seu resultado.
        // OU se estamos esperando um Martingale (sinalOriginalParaMartingale existe) e os dados mudaram,
        // isso também aciona verificarResultadoSinal para tentar gerar o Martingale.
        if ((ultimoSinal.sinalEsperado || sinalOriginalParaMartingale) && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]);
        }
        
        // Tenta gerar um novo sinal normal APENAS se:
        // 1. Não houver sinal ativo (ultimoSinal.sinalEsperado é null)
        // 2. Não estivermos no processo de esperar/gerar um Martingale (sinalOriginalParaMartingale é null)
        // 3. E (os dados da API mudaram OU é a primeira vez)
        if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI, false); // false indica que não é para forçar martingale
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
        console.info(`Assertividade (considerando ciclos com MG1): ${taxa}%`);
        console.info(`-------------------------------------------`);
        lastStatsLogTime = agora;
    }
}

function zerarEstatisticas() {
    // ... (sem alterações, mas já reseta sinalOriginalParaMartingale se existir)
    if (confirm("Tem certeza que deseja ZERAR TODAS as estatísticas? Esta ação não pode ser desfeita.")) {
        wins = 0;
        losses = 0;
        greenWins = 0;
        martingaleWins = 0;
        sinalOriginalParaMartingale = null; // Importante resetar

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
        console.warn("Elemento statusDiv não encontrado no DOM.");
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
        console.warn("Botão 'refresh-iframe' não encontrado no DOM.");
    }
});

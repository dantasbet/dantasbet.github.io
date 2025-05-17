// script.js (Frontend no GitHub Pages)

// --- Configuration ---
const GAMBLING_COUNTING_URL = 'https://gamblingcounting.com/pragmatic-brazilian-roulette'; // NOVA URL da fonte de dados
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // URL do seu worker
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(GAMBLING_COUNTING_URL)}`;
const API_PRIMARY_KEY = "RoletaBrasileiraNova"; // Chave no JSON do worker para os novos dados

const API_TIMEOUT = 20000;
const CHECK_INTERVAL = 7000; // Intervalo de verificação
const MAX_CORES_API = 200;    // Agora pegamos até 200 cores
const SIGNAL_COOLDOWN = 5000; // Cooldown para o mesmo gatilho
const STATS_INTERVAL = 60 * 10 * 1000; // Log de estatísticas a cada 10 min

// Parâmetros para Análise Dinâmica de Padrões
const MIN_PATTERN_LENGTH = 3;
const MAX_PATTERN_LENGTH = 5;
const MIN_OCCURRENCES_FOR_SIGNAL = 5; // Padrão deve ocorrer N vezes no histórico
const MIN_CONFIDENCE_FOR_SIGNAL = 0.65; // 65% de confiança para sinal
const CONSIDER_GREEN_IN_PATTERNS = false; // Se true, padrões podem incluir 'verde'.

// --- Global State ---
let ultimosRegistradosAPI = []; // Array das últimas N cores da API (até MAX_CORES_API)
let ultimoSinal = {
    sinalEsperado: null,        // 'vermelho' ou 'preto'
    gatilhoPadrao: null,        // String do padrão que gerou o sinal (ex: "V,P,V")
    timestampGerado: null,
    coresOrigemSinal: null,     // Array das cores que formaram o gatilho (ordem API: novo->antigo)
    ehMartingale: false         // True se este sinal é uma tentativa de Martingale
};
let sinalOriginalParaMartingale = null; // Guarda o sinal original que falhou e ativou o Martingale

let ultimosGatilhosProcessados = {}; // { "gatilhoString": timestamp }
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
        // console.log(message); // Reduzir logging para não poluir muito o console
    }
}

async function obterCoresAPI() {
    console.log("Buscando dados da API (nova fonte) via Worker...");
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

        if (dados && dados[API_PRIMARY_KEY] && Array.isArray(dados[API_PRIMARY_KEY])) {
            const cores = dados[API_PRIMARY_KEY];
            if (cores.length > 0) {
                // console.log(`Recebidas ${cores.length} cores. Exemplo:`, cores.slice(0,10));
                return cores.slice(0, MAX_CORES_API);
            } else {
                updateStatus(`Nenhuma cor retornada pela API (nova fonte). Resposta: ${JSON.stringify(dados).substring(0,100)}`, true);
                return null;
            }
        }
        updateStatus(`Formato de dados da API (nova fonte) inesperado. Esperado: {"${API_PRIMARY_KEY}": [...]}. Recebido: ${JSON.stringify(dados).substring(0,200)}`, true);
        return null;
    } catch (error) {
        if (error.name === 'AbortError') {
             updateStatus("Timeout ao buscar dados da API (nova fonte) via Worker.", true);
        } else {
            updateStatus(`ERRO DE FETCH ao contatar o Worker (nova fonte): ${error.message}`, true);
        }
        console.error("Detalhes completos do erro de fetch (Worker, nova fonte):", error);
        return null;
    }
}

function analisarPadroesDinamicos(historicoCores) {
    let melhorSinal = null;
    let maiorConfiancaGlobal = 0;
    let padraoGatilhoFinal = null; // Padrão que disparou, na ordem antigo->novo (ex: [V,P,V])
    let coresReaisDoGatilhoDetectado = null; // Cores do padrão, na ordem API (novo->antigo)

    if (!historicoCores || historicoCores.length < MAX_PATTERN_LENGTH + 1) {
        return [null, null, null];
    }

    const estatisticasPadroes = {};
    // Estrutura: { "V,P,V": { ocorrenciasComoGatilho: N, resultadosApos: {vermelho: X, preto: Y}, comprimento: L }}

    for (let len = MIN_PATTERN_LENGTH; len <= MAX_PATTERN_LENGTH; len++) {
        for (let i = 0; i <= historicoCores.length - (len + 1); i++) {
            const resultadoAposPadrao = historicoCores[i];
            const padraoArray = historicoCores.slice(i + 1, i + 1 + len).reverse(); // antigo -> novo

            let padraoValido = true;
            if (!CONSIDER_GREEN_IN_PATTERNS && padraoArray.includes('verde')) {
                padraoValido = false;
            }
            if (resultadoAposPadrao === 'verde') { // Não contamos verde como resultado para V/P
                padraoValido = false;
            }

            if (!padraoValido) continue;

            const chavePadrao = padraoArray.join(',');
            if (!estatisticasPadroes[chavePadrao]) {
                estatisticasPadroes[chavePadrao] = {
                    ocorrenciasComoGatilho: 0,
                    resultadosApos: { vermelho: 0, preto: 0 },
                    comprimento: len
                };
            }
            estatisticasPadroes[chavePadrao].ocorrenciasComoGatilho++;
            if (estatisticasPadroes[chavePadrao].resultadosApos[resultadoAposPadrao] !== undefined) {
                estatisticasPadroes[chavePadrao].resultadosApos[resultadoAposPadrao]++;
            }
        }
    }

    for (let len = MAX_PATTERN_LENGTH; len >= MIN_PATTERN_LENGTH; len--) {
        if (historicoCores.length < len) continue;

        const padraoAtualArray = historicoCores.slice(0, len).reverse(); // Padrão ATUAL, antigo -> novo

        if (!CONSIDER_GREEN_IN_PATTERNS && padraoAtualArray.includes('verde')) {
            continue;
        }
        
        const chavePadraoAtual = padraoAtualArray.join(',');

        if (estatisticasPadroes[chavePadraoAtual]) {
            const stats = estatisticasPadroes[chavePadraoAtual];
            if (stats.ocorrenciasComoGatilho < MIN_OCCURRENCES_FOR_SIGNAL) continue;

            const totalResultadosVP = stats.resultadosApos.vermelho + stats.resultadosApos.preto;
            if (totalResultadosVP === 0) continue;

            const confiancaVermelho = stats.resultadosApos.vermelho / totalResultadosVP;
            const confiancaPreto = stats.resultadosApos.preto / totalResultadosVP;

            let sinalCandidato = null;
            let confiancaCandidata = 0;

            if (confiancaVermelho >= MIN_CONFIDENCE_FOR_SIGNAL && confiancaVermelho > confiancaPreto) {
                sinalCandidato = 'vermelho';
                confiancaCandidata = confiancaVermelho;
            } else if (confiancaPreto >= MIN_CONFIDENCE_FOR_SIGNAL && confiancaPreto > confiancaVermelho) {
                sinalCandidato = 'preto';
                confiancaCandidata = confiancaPreto;
            }

            if (sinalCandidato && confiancaCandidata > maiorConfiancaGlobal) {
                maiorConfiancaGlobal = confiancaCandidata;
                melhorSinal = sinalCandidato;
                padraoGatilhoFinal = padraoAtualArray; // Padrão antigo->novo (ex: [V,P,V])
                coresReaisDoGatilhoDetectado = [...padraoAtualArray].reverse(); // Cores novo->antigo (ex: [V,P,V] se esse foi o padrão atual)
            }
        }
    }

    if (melhorSinal) {
        console.info(
            `PADRÃO DINÂMICO: Gatilho=[${padraoGatilhoFinal.join(',')}] (Antigo->Novo) ` +
            `Sinal: ${melhorSinal.toUpperCase()} ` +
            `Conf: ${(maiorConfiancaGlobal * 100).toFixed(2)}% ` +
            `(Base: ${estatisticasPadroes[padraoGatilhoFinal.join(',')].ocorrenciasComoGatilho} ocorrências, ${estatisticasPadroes[padraoGatilhoFinal.join(',')].resultadosApos[melhorSinal]} acertos para este sinal)`
        );
        // Retorna: [sinal, string_do_gatilho_para_cooldown (novo->antigo), array_cores_do_gatilho (novo->antigo)]
        return [melhorSinal, coresReaisDoGatilhoDetectado.join(','), coresReaisDoGatilhoDetectado];
    }
    return [null, null, null];
}

function gerenciarSinais(coresAtuaisAPI, forcarMartingale = false) {
    const [sinalDetectado, gatilhoDetectadoString, coresQueFormaramGatilhoAgora] = analisarPadroesDinamicos(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = gatilhoDetectadoString; // String do padrão (ex: "V,P,V" - ordem novo->antigo)

        if (!forcarMartingale) {
            if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
                console.log(`Cooldown para gatilho dinâmico "${gatilhoStr}" ativo. Sinal ignorado.`);
                return false;
            }
            const foiResolvidoRecentementeComMesmoGatilhoECores =
                (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
                ultimoSinalResolvidoInfo.gatilhoPadrao === gatilhoStr &&
                JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

            if (foiResolvidoRecentementeComMesmoGatilhoECores) {
                console.log("Gatilho dinâmico idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado.");
                return false;
            }
        }

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoStr, // String do padrão que gerou (novo->antigo)
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora], // Cores do padrão (novo->antigo)
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
            msgDisplay = `🎯 SINAL DINÂMICO\n➡️ Entrar no ${sinalUpper}`;
            // Poderia adicionar a confiança aqui se `maiorConfiancaGlobal` fosse passada.
            // Ex: msgDisplay = `🎯 SINAL DINÂMICO (${(confiancaDoPadrao * 100).toFixed(0)}%)\n➡️ Entrar no ${sinalUpper}`;
            textColor = "var(--accent-color)";
        }

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal Dinâmico: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''}`, false, false);
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
        console.info(`Resultado: GREEN WIN. Sinal era ${sinalResolvido.sinalEsperado}. Padrão: ${sinalResolvido.gatilhoPadrao}`);
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        wins++;
        if (sinalResolvido.ehMartingale) {
            msgResultado = "🎯 MARTINGALE GANHO! ✅";
            martingaleWins++;
        } else {
            msgResultado = "🎯 ACERTO! ✅";
        }
        resultadoCorTexto = "var(--success-color)";
        console.info(`Resultado: WIN. Sinal ${sinalResolvido.sinalEsperado} confirmado. Padrão: ${sinalResolvido.gatilhoPadrao}`);
    } else {
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎";
            losses++;
            resultadoCorTexto = "var(--danger-color)";
            console.info(`Resultado: MARTINGALE LOSS. Sinal era ${sinalResolvido.sinalEsperado}. Cor saída: ${novaCorRegistrada}. Padrão: ${sinalResolvido.gatilhoPadrao}`);
        } else {
            sinalOriginalParaMartingale = { ...sinalResolvido };
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            cicloEncerrado = false;
            console.info(`Resultado: LOSS no sinal normal (${sinalOriginalParaMartingale.sinalEsperado}). Cor saída: ${novaCorRegistrada}. Padrão: ${sinalOriginalParaMartingale.gatilhoPadrao}. Tentando Martingale 1...`);
            
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
            gatilhoPadrao: sinalResolvido.gatilhoPadrao, // String do padrão (novo->antigo)
            coresQueFormaramGatilho: sinalResolvido.coresOrigemSinal ? [...sinalResolvido.coresOrigemSinal] : null, // Array de cores (novo->antigo)
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

    const totalSinaisResolvidosConsiderandoCicloCompleto = wins + losses; // losses aqui já representa ciclos perdidos (incluindo MG)
    const winRate = (totalSinaisResolvidosConsiderandoCicloCompleto > 0) ? (wins / totalSinaisResolvidosConsiderandoCicloCompleto * 100) : 0;
    if (winRateSpan) {
        winRateSpan.textContent = winRate.toFixed(2) + "%";
    }
}

function exibirCoresApi(cores) {
    // Função para exibir as cores da API no console ou em algum elemento HTML, se desejado.
    // console.log("Cores mais recentes da API:", cores.slice(0, 10)); // Exibe as 10 mais recentes
}

async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI && coresAtuaisAPI.length > 0) {
        // exibirCoresApi(coresAtuaisAPI); // Descomente para logar as cores
        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !sinalOriginalParaMartingale && !ultimoSinal.sinalEsperado) {
             updateStatus("API OK (Nova Fonte). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if ((ultimoSinal.sinalEsperado || sinalOriginalParaMartingale) && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]); // A cor mais recente da API
        }
        
        if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            gerenciarSinais(coresAtuaisAPI, false);
        }

        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    } else if (coresAtuaisAPI === null) {
        // Erro já tratado por obterCoresAPI e updateStatus
    } else if (coresAtuaisAPI && coresAtuaisAPI.length === 0) {
        updateStatus("API retornou uma lista vazia de cores.", true);
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
    if (sinalTextoP && !sinalTextoP.textContent.includes("SINAL") && !sinalTextoP.textContent.includes("MARTINGALE")) {
        sinalTextoP.innerHTML = `
            <div class="signal-placeholder">
                <i class="fas fa-spinner fa-pulse"></i>
                <span>Aguardando sinal...</span>
            </div>`;
        sinalTextoP.style.color = "var(--gray-color)";
    }

    if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i>';
        statusDiv.title = "Bot Web da Roleta (Análise Dinâmica) Iniciado.";
        statusDiv.style.color = 'dodgerblue';
    }
    console.log("Bot Web da Roleta (Análise Dinâmica) Iniciado.");

    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now();
    mainLoop(); // Chama uma vez para buscar dados imediatamente
    setInterval(mainLoop, CHECK_INTERVAL);

    if (refreshIframeButton) {
        // Modificado: Refresh agora ZERA AS ESTATÍSTICAS E RECARREGA O IFRAME
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas(); // Chama a função de zerar estatísticas
            if (casinoIframe) {
                console.log("Atualizando iframe do cassino...");
                const currentSrc = casinoIframe.src;
                casinoIframe.src = 'about:blank'; // Força descarregamento
                setTimeout(() => { casinoIframe.src = currentSrc; }, 100); // Recarrega
                updateStatus("Iframe do cassino atualizado e estatísticas zeradas.", false, false);
            }
        });
    }
});

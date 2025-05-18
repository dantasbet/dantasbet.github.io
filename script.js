// script.js (Frontend no GitHub Pages)

// --- Configuration ---
const TARGET_API_URL = 'https://onixapis.com:2053/public/api/pragmatic/275'; // ATENÇÃO: A API MUDOU PARA 275 NO EXEMPLO ORIGINAL, MANTENDO AQUI
const PROXY_WORKER_URL = 'https://proxy-worker-roleta.dantasbet.workers.dev/'; // CONFIRME ESTA URL!
const API_URL = `${PROXY_WORKER_URL}?url=${encodeURIComponent(TARGET_API_URL)}`;

const API_TIMEOUT = 15000;
const CHECK_INTERVAL = 5000;
const MAX_CORES_API = 50; // Aumentar para ter um histórico maior para análise dinâmica
const SIGNAL_COOLDOWN = 5000;
const STATS_INTERVAL = 60 * 10 * 1000;

// --- Configurações para Detecção Dinâmica de Padrões ---
const MIN_DYNAMIC_PATTERN_LENGTH = 3; // Comprimento mínimo de uma sequência para ser considerada um padrão
const MAX_DYNAMIC_PATTERN_LENGTH = 6; // Comprimento máximo de uma sequência
const MIN_OCCURRENCES_FOR_RELIABLE_SIGNAL = 2; // Padrão deve ter ocorrido pelo menos X vezes com um resultado dominante

// --- Global State ---
let ultimosRegistradosAPI = [];
let ultimoSinal = {
    sinalEsperado: null,
    gatilhoPadrao: null, // Agora será o padrão dinâmico detectado
    timestampGerado: null,
    coresOrigemSinal: null,
    ehMartingale: false
};
let ultimosGatilhosProcessados = {}; // Usado para cooldown do padrão stringificado
let ultimoSinalResolvidoInfo = {
    gatilhoPadrao: null,
    coresQueFormaramGatilho: null,
    timestampResolvido: 0
};

let baseDeConhecimentoDinamica = {}; // Estrutura: { '["P","V","P"]': { outcomes: {V:2, P:1}, total: 3 } }

let wins = parseInt(localStorage.getItem('roletaWins')) || 0;
let losses = parseInt(localStorage.getItem('roletaLosses')) || 0;
let greenWins = parseInt(localStorage.getItem('roletaGreenWins')) || 0;
let martingaleWins = parseInt(localStorage.getItem('roletaMartingaleWins')) || 0;
let lastStatsLogTime = Date.now();
let aguardandoOportunidadeMartingale = false;
let sinalOriginalParaMartingale = null;


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
        if (isError) { iconClass = 'fa-times-circle'; color = 'crimson'; titleMessage = `Erro: ${message}`; }
        else if (isSuccess) { iconClass = 'fa-check-circle'; color = 'green'; titleMessage = `Status: ${message}`; }
        statusDiv.innerHTML = `<i class="fas ${iconClass}"></i>`;
        statusDiv.style.color = color;
        statusDiv.title = titleMessage;
    }
    if (isError) console.error(message); else console.log(message);
}

async function obterCoresAPI() {
    console.log("Buscando dados da API via Worker...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(API_URL, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorBody = "N/A"; try { errorBody = await response.text(); } catch (e) {}
            updateStatus(`Erro HTTP ${response.status} via Worker: ${response.statusText}`, true);
            console.error("Corpo erro Worker:", errorBody.substring(0, 500));
            return null;
        }
        const dados = await response.json();
        if (dados && dados["Roleta Brasileira"] && Array.isArray(dados["Roleta Brasileira"])) {
            const numerosStr = dados["Roleta Brasileira"];
            if (numerosStr.length > 0) {
                const cores = numerosStr.slice(0, MAX_CORES_API).map(identificarCor);
                const coresValidas = cores.filter(cor => cor !== 'inválido');
                if (coresValidas.length === 0) {
                    updateStatus("Nenhuma cor válida da API (Worker).", true); return null;
                }
                return coresValidas;
            }
        }
        updateStatus("Formato dados API inesperado (Worker).", true); return null;
    } catch (error) {
        if (error.name === 'AbortError') updateStatus("Timeout API (Worker).", true);
        else updateStatus(`ERRO FETCH (Worker): ${error.message}`, true);
        console.error("Detalhes erro fetch (Worker):", error); return null;
    }
}

// NOVA FUNÇÃO: Atualiza a base de conhecimento com padrões observados
function atualizarBaseDeConhecimentoDinamica(historicoCores) {
    if (!historicoCores || historicoCores.length < MIN_DYNAMIC_PATTERN_LENGTH + 1) {
        return; // Precisa de histórico suficiente para um padrão + um resultado
    }

    baseDeConhecimentoDinamica = {}; // Reinicia para recalcular com o histórico mais recente

    // Itera sobre os comprimentos de padrão possíveis
    for (let len = MIN_DYNAMIC_PATTERN_LENGTH; len <= MAX_DYNAMIC_PATTERN_LENGTH; len++) {
        // Itera sobre o histórico para encontrar todas as subsequências de comprimento 'len'
        // O loop vai até historicoCores.length - len para garantir que haja uma cor *após* a sequência
        for (let i = 0; i <= historicoCores.length - len - 1; i++) {
            // A sequência (padrão) é da mais antiga para a mais nova dentro da subsequência
            // Mas a API nos dá [MAIS_RECENTE, ..., MAIS_ANTIGA]
            // Então, para um padrão como [c1, c2, c3] (c1 mais recente),
            // no histórico [..., c_antiga3, c_antiga2, c_antiga1, c1_resultado, c2, c3]
            // o padrão é [c3, c2, c1_resultado] e o outcome é c_antiga1
            // Precisamos inverter a ordem para consistência ou usar a ordem da API.
            // Vamos usar a ordem da API: [MAIS_RECENTE, ..., MENOS_RECENTE_DO_PADRAO]
            const padraoArray = historicoCores.slice(i + 1, i + 1 + len).reverse(); // Padrão do mais antigo para o mais novo
            const resultadoDaSequencia = historicoCores[i]; // A cor que SEGUIU o padrão

            // Para o nosso sistema, o padrão é verificado contra as cores MAIS RECENTES da API.
            // Ex: API = [R, P, V, P, V] (R mais recente)
            // Se len = 3, queremos ver padrões que levaram a R.
            // Um padrão seria [P,V,P] (imediatamente antes de R).
            // Outro seria [V,P,V] (imediatamente antes de P, que foi antes de R).

            // Revisitando a lógica de extração de padrões:
            // historicoCores = [corN, corN-1, corN-2, ..., cor1] (corN é a mais recente)
            // Para um padrão de comprimento `len` que levou a `corX`:
            // [corX, padrao1, padrao2, ..., padraoLen]
            // Então `corX` é `historicoCores[i]`
            // E o padrão é `historicoCores.slice(i+1, i+1+len)`
            // Este padrão `[padrao1, ..., padraoLen]` é o que queremos usar como chave.

            const sequenciaGatilho = historicoCores.slice(i + 1, i + 1 + len);
            const corResultado = historicoCores[i]; // A cor que efetivamente saiu APÓS a sequenciaGatilho

            if (sequenciaGatilho.length !== len) continue; // Sanity check

            const padraoStr = JSON.stringify(sequenciaGatilho);

            if (!baseDeConhecimentoDinamica[padraoStr]) {
                baseDeConhecimentoDinamica[padraoStr] = {
                    outcomes: { vermelho: 0, preto: 0, verde: 0 },
                    totalOcorrencias: 0
                };
            }
            baseDeConhecimentoDinamica[padraoStr].outcomes[corResultado]++;
            baseDeConhecimentoDinamica[padraoStr].totalOcorrencias++;
        }
    }
    // console.log("Base de conhecimento atualizada:", baseDeConhecimentoDinamica);
}

// MODIFICADO: Verifica padrões com base na base de conhecimento dinâmica
function verificarPadraoDinamico(coresRecentesAPI) {
    if (!coresRecentesAPI || coresRecentesAPI.length < MIN_DYNAMIC_PATTERN_LENGTH) {
        return [null, null, null];
    }

    let melhorPadraoEncontrado = null;
    let sinalDoMelhorPadrao = null;
    let confiancaMelhorPadrao = 0; // Para desempatar, podemos usar a confiança (ocorrências do sinal / total de ocorrências do padrão)

    // Itera dos comprimentos de padrão mais longos para os mais curtos
    for (let len = MAX_DYNAMIC_PATTERN_LENGTH; len >= MIN_DYNAMIC_PATTERN_LENGTH; len--) {
        if (coresRecentesAPI.length < len) continue;

        const sequenciaAtualObservada = coresRecentesAPI.slice(0, len); // As 'len' cores mais recentes
        const padraoAtualStr = JSON.stringify(sequenciaAtualObservada);

        if (baseDeConhecimentoDinamica[padraoAtualStr]) {
            const infoPadrao = baseDeConhecimentoDinamica[padraoAtualStr];
            if (infoPadrao.totalOcorrencias >= MIN_OCCURRENCES_FOR_RELIABLE_SIGNAL) { // Mínimo de vezes que o padrão deve ter sido visto
                let corMaisFrequente = null;
                let maxFrequencia = 0;

                for (const corOutcome in infoPadrao.outcomes) {
                    if (corOutcome === 'verde') continue; // Normalmente não apostamos no verde como sinal direto
                    if (infoPadrao.outcomes[corOutcome] > maxFrequencia) {
                        maxFrequencia = infoPadrao.outcomes[corOutcome];
                        corMaisFrequente = corOutcome;
                    } else if (infoPadrao.outcomes[corOutcome] === maxFrequencia) {
                        corMaisFrequente = null; // Empate, sem sinal claro
                    }
                }

                if (corMaisFrequente && maxFrequencia >= MIN_OCCURRENCES_FOR_RELIABLE_SIGNAL) { // O resultado dominante deve ter ocorrido um mínimo de vezes
                    const confiancaAtual = maxFrequencia / infoPadrao.totalOcorrencias;
                    // Aqui você poderia adicionar um MIN_SUCCESS_RATE_FOR_SIGNAL se quisesse
                    // if (confiancaAtual < MIN_SUCCESS_RATE_FOR_SIGNAL) continue;

                    // Prioriza o padrão mais longo ou com maior confiança (se comprimentos iguais)
                    // Neste caso, como iteramos do mais longo para o mais curto, o primeiro encontrado é o mais longo.
                    // Poderíamos adicionar uma lógica para desempatar por confiança se necessário.
                    // Por enquanto, o primeiro padrão válido encontrado (que é o mais longo) será usado.
                    console.info("PADRÃO DINÂMICO ENCONTRADO:", padraoAtualStr, "SINAL:", corMaisFrequente, "Confiança:", confiancaAtual.toFixed(2), "Baseado em", infoPadrao.totalOcorrencias, "ocorrências.");
                    return [corMaisFrequente, sequenciaAtualObservada, sequenciaAtualObservada];
                }
            }
        }
    }
    return [null, null, null]; // Nenhum padrão dinâmico confiável encontrado
}


// MODIFICADO: gerenciarSinais agora usa verificarPadraoDinamico
function gerenciarSinais(coresAtuaisAPI, forcarMartingale = false) {
    // AGORA verificarPadrao é verificarPadraoDinamico
    const [sinalDetectado, gatilhoDetectado, coresQueFormaramGatilhoAgora] = verificarPadraoDinamico(coresAtuaisAPI);

    if (sinalDetectado) {
        const agora = Date.now();
        const gatilhoStr = JSON.stringify(gatilhoDetectado);

        if (!forcarMartingale) {
            if (ultimosGatilhosProcessados[gatilhoStr] && (agora - ultimosGatilhosProcessados[gatilhoStr] < SIGNAL_COOLDOWN)) {
                console.log(`Cooldown para gatilho dinâmico ${gatilhoStr} ativo. Sinal ignorado.`);
                return false;
            }
            const foiResolvidoRecentementeComMesmoGatilhoECores =
                (agora - ultimoSinalResolvidoInfo.timestampResolvido < SIGNAL_COOLDOWN) &&
                JSON.stringify(ultimoSinalResolvidoInfo.gatilhoPadrao) === gatilhoStr &&
                JSON.stringify(ultimoSinalResolvidoInfo.coresQueFormaramGatilho) === JSON.stringify(coresQueFormaramGatilhoAgora);

            if (foiResolvidoRecentementeComMesmoGatilhoECores) {
                console.log("Gatilho dinâmico idêntico com mesmas cores de origem resolvido recentemente. Sinal ignorado.");
                return false;
            }
        }

        ultimoSinal = {
            sinalEsperado: sinalDetectado,
            gatilhoPadrao: gatilhoDetectado,
            timestampGerado: agora,
            coresOrigemSinal: [...coresQueFormaramGatilhoAgora],
            ehMartingale: forcarMartingale
        };
        ultimosGatilhosProcessados[gatilhoStr] = agora;

        if (forcarMartingale) {
            sinalOriginalParaMartingale = null;
        }

        const sinalUpper = ultimoSinal.sinalEsperado.toUpperCase();
        let msgDisplay = ultimoSinal.ehMartingale ? `🔄 MARTINGALE 1\n➡️ Entrar no ${sinalUpper}` : `🏹 SINAL DINÂMICO\n➡️ Entrar no ${sinalUpper}`;
        let textColor = ultimoSinal.ehMartingale ? "var(--secondary-color)" : "var(--accent-color)"; // Pode querer uma cor diferente para sinal dinâmico

        if (sinalTextoP) {
            sinalTextoP.innerHTML = msgDisplay.replace('\n', '<br>');
            sinalTextoP.style.color = textColor;
            const placeholderDiv = sinalTextoP.querySelector('.signal-placeholder');
            if(placeholderDiv) placeholderDiv.remove();
        }
        updateStatus(`Sinal: ${sinalUpper}${ultimoSinal.ehMartingale ? ' (Martingale 1)' : ''} (Dinâmico)`, false, false);
        return true;
    }
    return false;
}

// verificarResultadoSinal: A lógica interna permanece a mesma da sua última versão funcional.
// As estatísticas e mensagens de vitória/derrota são baseadas no `ultimoSinal` gerado (seja ele fixo ou dinâmico).
function verificarResultadoSinal(novaCorRegistrada) {
    if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale) {
        return;
    }

    if (sinalOriginalParaMartingale) {
        // console.log("API atualizou. Tentando gerar Martingale baseado em padrão dinâmico...");
        const martingaleGerado = gerenciarSinais(ultimosRegistradosAPI, true); // Usa as cores que já temos
        if (martingaleGerado) {
            return; 
        } else {
            if (sinalTextoP && !sinalTextoP.innerHTML.includes("MARTINGALE")) {
                 sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                 sinalTextoP.style.color = "var(--warning-color)";
            }
            // console.log("Nenhum padrão dinâmico para Martingale 1. Aguardando...");
            return; 
        }
    }

    const sinalResolvido = { ...ultimoSinal };
    let msgResultado = "";
    let resultadoCorTexto = "var(--accent-color)";
    let cicloEncerrado = true;

    if (novaCorRegistrada === 'verde') {
        wins++; greenWins++;
        msgResultado = sinalResolvido.ehMartingale ? (martingaleWins++, "🎯 MARTINGALE GANHO (VERDE)! 🎰") : "🎯 VITÓRIA NO VERDE! 🎰";
        resultadoCorTexto = "var(--green-color)";
    } else if (novaCorRegistrada === sinalResolvido.sinalEsperado) {
        wins++;
        msgResultado = sinalResolvido.ehMartingale ? (martingaleWins++, "🎯 MARTINGALE GANHO! ✅") : "🎯 ACERTO! ✅";
        resultadoCorTexto = "var(--success-color)";
    } else {
        if (sinalResolvido.ehMartingale) {
            msgResultado = "❌ ERRO NO MARTINGALE! 👎"; losses++;
            resultadoCorTexto = "var(--danger-color)";
        } else {
            sinalOriginalParaMartingale = { ...sinalResolvido };
            ultimoSinal = { sinalEsperado: null, gatilhoPadrao: null, timestampGerado: null, coresOrigemSinal: null, ehMartingale: false };
            cicloEncerrado = false;
            console.log(`Falha no sinal dinâmico (${sinalOriginalParaMartingale.sinalEsperado}). Tentando Martingale 1...`);
            const martingaleGeradoAgora = gerenciarSinais(ultimosRegistradosAPI, true);
            if (martingaleGeradoAgora) return;
            else {
                if (sinalTextoP) {
                    sinalTextoP.innerHTML = `⏳ Aguardando padrão<br>para Martingale 1...`;
                    sinalTextoP.style.color = "var(--warning-color)";
                }
                // console.log("Nenhum padrão dinâmico para Martingale 1 imediatamente. Aguardando...");
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
        updateStatus(statusMsg, false, false);

        setTimeout(() => {
            const placeholderAtivo = sinalTextoP && sinalTextoP.querySelector('.signal-placeholder');
            if (sinalTextoP && sinalTextoP.innerHTML.includes(msgResultado.split('\n')[0]) && !ultimoSinal.sinalEsperado && !placeholderAtivo ) {
                 sinalTextoP.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
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
    if (winRateSpan) winRateSpan.textContent = winRate.toFixed(2);
}

function exibirCoresApi(cores) { /* console.log("Cores API display:", cores); */ }

// MODIFICADO: mainLoop para incluir atualização da base de conhecimento
async function mainLoop() {
    const coresAtuaisAPI = await obterCoresAPI();

    if (coresAtuaisAPI) {
        exibirCoresApi(coresAtuaisAPI);
        // Atualiza a base de conhecimento com o histórico mais recente ANTES de tentar gerar/resolver sinais
        if (ultimosRegistradosAPI.length >= MIN_DYNAMIC_PATTERN_LENGTH + 1) { // Só atualiza se tiver histórico mínimo
            atualizarBaseDeConhecimentoDinamica(ultimosRegistradosAPI);
        }

        if (statusDiv && !statusDiv.title.startsWith("Erro:") && !sinalOriginalParaMartingale && !ultimoSinal.sinalEsperado) {
             updateStatus("API OK (Worker). Monitorando...", false, true);
        }

        const dadosDaApiMudaram = (JSON.stringify(coresAtuaisAPI) !== JSON.stringify(ultimosRegistradosAPI));

        if ((ultimoSinal.sinalEsperado || sinalOriginalParaMartingale) && dadosDaApiMudaram) {
            verificarResultadoSinal(coresAtuaisAPI[0]);
        }
        
        if (!ultimoSinal.sinalEsperado && !sinalOriginalParaMartingale && (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0)) {
            // O false indica que não é para forçar martingale aqui; isso é decidido por verificarResultadoSinal
            gerenciarSinais(coresAtuaisAPI, false); 
        }

        if (dadosDaApiMudaram || ultimosRegistradosAPI.length === 0) {
            ultimosRegistradosAPI = [...coresAtuaisAPI];
        }
    }

    const agora = Date.now();
    if (agora - lastStatsLogTime >= STATS_INTERVAL) {
        console.info(`--- Estatísticas (${new Date().toLocaleTimeString()}) ---`);
        console.info(`Acertos: ${wins}, Verdes: ${greenWins}, MG Wins: ${martingaleWins}, Erros: ${losses}`);
        const total = wins + losses;
        const taxa = total > 0 ? (wins / total * 100).toFixed(2) : "0.00";
        console.info(`Assertividade: ${taxa}%`);
        console.info(`Base de Conhecimento: ${Object.keys(baseDeConhecimentoDinamica).length} padrões aprendidos.`);
        console.info(`-------------------------------------------`);
        lastStatsLogTime = agora;
    }
}

function zerarEstatisticas() {
    if (confirm("Zerar TODAS estatísticas e aprendizado dinâmico?")) {
        wins = 0; losses = 0; greenWins = 0; martingaleWins = 0;
        sinalOriginalParaMartingale = null;
        baseDeConhecimentoDinamica = {}; // Limpa o aprendizado
        ultimosRegistradosAPI = []; // Limpa o histórico para recomeçar o aprendizado

        localStorage.removeItem('roletaWins'); localStorage.removeItem('roletaLosses');
        localStorage.removeItem('roletaGreenWins'); localStorage.removeItem('roletaMartingaleWins');

        atualizarEstatisticasDisplay();
        console.warn("ESTATÍSTICAS E APRENDIZADO DINÂMICO ZERADOS!");
        updateStatus("Estatísticas e aprendizado zerados.", false, false);
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    if (sinalTextoP && !sinalTextoP.textContent.includes("SINAL") && !sinalTextoP.textContent.includes("MARTINGALE")) {
        sinalTextoP.innerHTML = `<div class="signal-placeholder"><i class="fas fa-spinner fa-pulse"></i><span>Aguardando sinal...</span></div>`;
        sinalTextoP.style.color = "var(--gray-color)";
    }
    if (statusDiv) {
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i>';
        statusDiv.title = "Bot Roleta Dinâmico Iniciado.";
        statusDiv.style.color = 'dodgerblue';
    } else console.warn("Elemento statusDiv não encontrado.");
    console.log("Bot Roleta Dinâmico Iniciado.");

    atualizarEstatisticasDisplay();
    lastStatsLogTime = Date.now();
    mainLoop();
    setInterval(mainLoop, CHECK_INTERVAL);

    if (refreshIframeButton) {
        refreshIframeButton.addEventListener('click', () => {
            zerarEstatisticas();
            if (casinoIframe) {
                console.log("Atualizando iframe cassino...");
                casinoIframe.src = casinoIframe.src;
                updateStatus("Iframe cassino atualizado.", false, false);
            }
        });
    } else console.warn("Botão 'refresh-iframe' não encontrado.");
});

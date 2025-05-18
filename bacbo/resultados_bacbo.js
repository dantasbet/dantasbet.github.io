// resultados_bacbo.js

const PLAYER_WIN = "PLAYER";
const BANKER_WIN = "BANKER";
const TIE_RESULT = "TIE";
const INVALID_RESULT = "inválido";

/**
 * Identifica o resultado do Bac Bo a partir da string da API.
 * @param {string} apiResultadoStr - A string retornada pela API para um resultado.
 * @returns {string} - "PLAYER", "BANKER", "TIE", ou "inválido".
 */
function identificarResultadoBacBo(apiResultadoStr) {
    if (apiResultadoStr === null || apiResultadoStr === undefined) {
        return INVALID_RESULT;
    }

    const resultado = String(apiResultadoStr).toLowerCase().trim();

    // ****** IMPORTANTE: VOCÊ PRECISA AJUSTAR ESTAS CONDIÇÕES ******
    // ****** COM BASE NO QUE A API REALMENTE RETORNA! ******
    // Exemplo: se a API retorna "player_win", "banker_win", "tie"
    if (resultado === "player" || resultado === "p" || resultado === "player_win") {
        return PLAYER_WIN;
    } else if (resultado === "banker" || resultado === "b" || resultado === "banker_win") {
        return BANKER_WIN;
    } else if (resultado === "tie" || resultado === "t" || resultado === "empate") {
        return TIE_RESULT;
    }
    // Adicione mais `else if` conforme necessário para cobrir todos os retornos da API.
    
    console.warn(`Resultado desconhecido da API Bac Bo: '${apiResultadoStr}'`);
    return INVALID_RESULT;
}

// Se a API retornar um objeto mais complexo por resultado, a função precisará ser ajustada
// para extrair a informação relevante desse objeto.
// Exemplo: se a API retorna { winner: "player", playerScore: 8, bankerScore: 5 }
// function identificarResultadoBacBo(apiResultadoObj) {
//     if (!apiResultadoObj || !apiResultadoObj.winner) return INVALID_RESULT;
//     const winner = String(apiResultadoObj.winner).toLowerCase().trim();
//     if (winner === "player") return PLAYER_WIN;
//     // ... e assim por diante
// }
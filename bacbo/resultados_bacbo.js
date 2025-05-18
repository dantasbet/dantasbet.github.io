// Em resultados_bacbo.js

const PLAYER_WIN = "PLAYER";
const BANKER_WIN = "BANKER";
const TIE_RESULT = "TIE";
const INVALID_RESULT = "inválido";

/**
 * Identifica o resultado do Bac Bo a partir do objeto da API.
 * @param {object} apiResultadoObj - O objeto de resultado retornado pela API.
 *                                 Ex: { bankerScore: 6, playerScore: 9, winner: "Player" }
 * @returns {string} - "PLAYER", "BANKER", "TIE", ou "inválido".
 */
function identificarResultadoBacBo(apiResultadoObj) {
    if (apiResultadoObj === null || apiResultadoObj === undefined || typeof apiResultadoObj.winner === 'undefined') {
        console.warn("Objeto de resultado da API Bac Bo inválido ou sem propriedade 'winner':", apiResultadoObj);
        return INVALID_RESULT;
    }

    const winnerStr = String(apiResultadoObj.winner).toLowerCase().trim();

    if (winnerStr === "player") {
        return PLAYER_WIN;
    } else if (winnerStr === "banker") {
        return BANKER_WIN;
    } else if (winnerStr === "tie") { // Supondo que "Tie" seja o valor para empate
        return TIE_RESULT;
    }
    
    console.warn(`Valor 'winner' desconhecido da API Bac Bo: '${apiResultadoObj.winner}'`);
    return INVALID_RESULT;
}

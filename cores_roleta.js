// cores_roleta.js
const vermelhos = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const pretos = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);
const verde = new Set([0]);

function identificarCor(numeroStr) {
    if (numeroStr === null || numeroStr === undefined) {
        return 'inválido';
    }
    try {
        const num = parseInt(numeroStr, 10);
        if (isNaN(num)) {
            return 'inválido';
        }
        if (vermelhos.has(num)) {
            return 'vermelho';
        } else if (pretos.has(num)) {
            return 'preto';
        } else if (verde.has(num)) {
            return 'verde';
        }
        return 'inválido';
    } catch (e) {
        return 'inválido';
    }
}
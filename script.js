// Mapeamento dos números e suas mensagens de entrada
const mensagens = {
    0: "entrar no 34, 14, 32, 10 com 1 vizinho",
    1: "entrar no 36, 1, 2, 29 com 1 vizinho",
    2: "entrar no 20, 5, 22, 2 com 1 vizinho",
    3: "entrar no 35, 4, 33, 6 com 1 vizinho",
    4: "entrar no 12, 22, 2, 24 com 1 vizinho",
    5: "entrar no 18, 6, 24, 2 com 1 vizinho",
    6: "entrar no 5, 20, 12, 17 com 1 vizinho",
    7: "entrar no 16, 14, 28, 4 com 1 vizinho",
    8: "entrar no 11, 28, 35, 31 com 1 vizinho",
    9: "entrar no 31, 11, 6, 3 com 1 vizinho",
    10: "entrar no 23, 20, 28, 19 com 1 vizinho",
    11: "entrar no 8, 29, 31, 13 com 1 vizinho",
    12: "entrar no 21, 32, 36, 3 com 1 vizinho",
    13: "entrar no 31, 11, 33, 15 com 1 vizinho",
    14: "entrar no 34, 14, 30, 5 com 1 vizinho",
    15: "entrar no 35, 20, 17, 24 com 1 vizinho",
    16: "entrar no 36, 19, 7, 34 com 1 vizinho",
    17: "entrar no 17, 22, 16, 8 com 1 vizinho",
    18: "entrar no 5, 6, 22, 19 com 1 vizinho",
    19: "entrar no 16, 28, 21, 36 com 1 vizinho",
    20: "entrar no 2, 20, 10, 6 com 1 vizinho",
    21: "entrar no 21, 12, 19, 16 com 1 vizinho",
    22: "entrar no 2, 17, 32, 18 com 1 vizinho",
    23: "entrar no 32, 23, 7, 14 com 1 vizinho",
    24: "entrar no 27, 22, 7, 26 com 1 vizinho",
    25: "entrar no 27, 22, 2, 26 com 1 vizinho",
    26: "entrar no 29, 0, 23, 34 com 1 vizinho",
    27: "entrar no 24, 25, 13, 26 com 1 vizinho",
    28: "entrar no 8, 12, 19, 24 com 1 vizinho",
    29: "entrar no 26, 11, 1, 18 com 1 vizinho",
    30: "entrar no 14, 30, 36, 16 com 1 vizinho",
    31: "entrar no 13, 22, 28, 11 com 1 vizinho",
    32: "entrar no 23, 12, 22, 15 com 1 vizinho",
    33: "entrar no 36, 31, 3, 1 com 1 vizinho",
    34: "entrar no 0, 14, 34, 36 com 1 vizinho",
    35: "entrar no 15, 12, 8, 9 com 1 vizinho",
    36: "entrar no 16, 36, 1, 12 com 1 vizinho"
};

// Função para exibir a mensagem com base no número digitado
function confirmarNumero() {
    const numero = document.getElementById("ultimoNumero").value;
    const resultado = document.getElementById("resultado");

    if (mensagens.hasOwnProperty(numero)) {
        resultado.textContent = `Recomendação: ${mensagens[numero]}`;
    } else {
        resultado.textContent = "Número inválido. Por favor, insira um número entre 0 e 36.";
    }
}

// Adiciona o evento de clique ao botão Confirmar
document.getElementById("confirmarBtn").addEventListener("click", confirmarNumero);
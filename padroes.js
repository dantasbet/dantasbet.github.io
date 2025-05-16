// padroes.js
const V = "vermelho";
const P = "preto";
// const G = "verde";

let PADROES = [
    // Padrões específicos (copiados diretamente do seu .py, assumindo ordem correta para API)
    { "sequencia": [P, V, V, V, V, P, P, P, V, V, P], "sinal": V },
    { "sequencia": [V, P, P, P, P, V, V, V, P, P, V], "sinal": P },
    { "sequencia": [P, V, V, V, P, P, V], "sinal": P },
    { "sequencia": [V, P, P, P, V, V, P], "sinal": V },
    { "sequencia": [P, V, V, P, P], "sinal": V },
    { "sequencia": [V, P, P, V, V], "sinal": P },
    { "sequencia": [P, V, V, P, V, V, P], "sinal": V },
    { "sequencia": [V, P, P, V, P, P, V], "sinal": P },
    { "sequencia": [P, V, V, V, P, V, V, P], "sinal": V },
    { "sequencia": [V, P, P, P, V, P, P, V], "sinal": P },
    { "sequencia": [V, V, P, V, P], "sinal": V },
    { "sequencia": [P, P, V, P, V], "sinal": P },
    { "sequencia": [V, V, P, V, P, V, P], "sinal": P },
    { "sequencia": [P, P, V, P, V, P, V], "sinal": V },

    // Tipo 1
    { "sequencia": [P, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [V, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P, P, P, P], "sinal": P },

    // Tipo 2
    { "sequencia": [P, P, P, V, V, V], "sinal": V },
    { "sequencia": [P, P, P, P, V, V, V, V], "sinal": V },
    { "sequencia": [P, P, P, P, P, V, V, V, V, V], "sinal": V },
    { "sequencia": [P, P, P, P, P, P, V, V, V, V, V, V], "sinal": V },
    { "sequencia": [V, V, V, P, P, P], "sinal": P },
    { "sequencia": [V, V, V, V, P, P, P, P], "sinal": P },
    { "sequencia": [V, V, V, V, V, P, P, P, P, P], "sinal": P },
    { "sequencia": [V, V, V, V, V, V, P, P, P, P, P, P], "sinal": P }
];

PADROES.sort((a, b) => b.sequencia.length - a.sequencia.length);
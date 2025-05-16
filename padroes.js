// padroes.js
const V = "vermelho";
const P = "preto";
// const G = "verde"; // Verde não é usado nas sequências de gatilho

let PADROES = [
    // Sua lista de padrões revisada, traduzida diretamente:
    // Formato: { "sequencia": [MAIS_RECENTE_DA_API, ..., MAIS_ANTIGO_DA_SEQUENCIA_NA_API], "sinal": SINAL_ESPERADO }

    { "sequencia": [P, V, P, V], "sinal": V },
    { "sequencia": [V, P, V, P], "sinal": P },
    { "sequencia": [P, V, P, V, P, V], "sinal": P },
    { "sequencia": [V, P, V, P, V, P], "sinal": V },
    { "sequencia": [V, P, P, V, V, V, P], "sinal": P },
    { "sequencia": [P, V, V, P, P, P, V], "sinal": V },
    { "sequencia": [P, V, V, P, V, V, V, P], "sinal": V },
    { "sequencia": [V, P, P, V, P, P, P, V], "sinal": P },
    { "sequencia": [V, V, P, P, V, V, P], "sinal": P },
    { "sequencia": [P, P, V, V, P, P, V], "sinal": V },
    { "sequencia": [P, V, V, P, V, V, P], "sinal": V },
    { "sequencia": [V, P, P, V, P, P, V], "sinal": P },
    { "sequencia": [V, V, P, P, P, V, V, V, V, P], "sinal": P },
    { "sequencia": [P, P, V, V, V, P, P, P, P, V], "sinal": V },

    { "sequencia": [P, P, P, V, V, V, P], "sinal": V },
    { "sequencia": [P, P, P, P, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, P, P, P, P, V, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, P, P, P, P, P, V, V, V, V, V, V, P], "sinal": V },

    { "sequencia": [V, V, V, P, P, P, V], "sinal": P },
    { "sequencia": [V, V, V, V, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, V, V, V, V, P, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, V, V, V, V, V, P, P, P, P, P, P, V], "sinal": P },

    { "sequencia": [P, V, V, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V, P], "sinal": V },
    { "sequencia": [P, V, V, V, V, V, V, V, V, V, V, P], "sinal": V },

    { "sequencia": [V, P, P, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P, V], "sinal": P },
    { "sequencia": [V, P, P, P, P, P, P, P, P, P, P, V], "sinal": P }
];

// Ordena os padrões pela extensão da sequência, do mais longo para o mais curto.
// Isso é CRUCIAL para que padrões mais específicos (e longos) sejam verificados ANTES.
PADROES.sort((a, b) => b.sequencia.length - a.sequencia.length);

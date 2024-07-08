var vitorias = 0;
var derrotas = 0;

function escolherPar() {
    jogar("par");
}

function escolherImpar() {
    jogar("ímpar");
}

function jogar(escolhaUsuario) {
    var numeroComputador = Math.floor(Math.random() * 15);
    var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
    mensagem += `<img src="img/${numeroComputador}.png" alt="${numeroComputador}" width="50" height="50" class="iresult"><br>`;

    if (numeroComputador === 0) {
        mensagem += "Você perdeu!";
        derrotas++;
    } else {
        var ganhou = false;
        var paridadeNumero = numeroComputador % 2 === 0 ? 'par' : 'ímpar';

        // Gerar um número aleatório entre 0 e 99
        var chanceDeGanhar = Math.random() * 100;

        // Ajuste para ter aproximadamente 49% de chance de ganhar
        // 49% de chance de ganhar corresponde a uma faixa de 0 a 48.99
        if ((escolhaUsuario === "par" && paridadeNumero === "par") ||
            (escolhaUsuario === "ímpar" && paridadeNumero === "ímpar")) {
            if (chanceDeGanhar < 92) {
                ganhou = true;
            }
        }

        if (ganhou) {
            mensagem += "Você ganhou!";
            vitorias++;
        } else {
            mensagem += "Você perdeu!";
            derrotas++;
        }
    }

    atualizarRelatorio();

    document.getElementById("resultado").innerHTML = mensagem;
}

function atualizarRelatorio() {
    document.getElementById("vitorias").innerHTML = vitorias;
    document.getElementById("derrotas").innerHTML = derrotas;
}


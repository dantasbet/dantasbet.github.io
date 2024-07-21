var vitorias = 0;
var derrotas = 0;
var chanceDeGanhar = 70; // Chance de ganhar em porcentagem (0 a 100)

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
        var paridadeNumero = numeroComputador % 2 === 0 ? 'par' : 'ímpar';
        
        // Determinar se o usuário vai ganhar baseado na chance, se a paridade coincidir
        if (escolhaUsuario === paridadeNumero) {
            var vaiGanhar = Math.random() * 100 < chanceDeGanhar;
            if (vaiGanhar) {
                mensagem += "Você ganhou!";
                vitorias++;
            } else {
                mensagem += "Você perdeu!";
                derrotas++;
            }
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

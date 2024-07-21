var vitorias = 0;
var derrotas = 0;
var historico = []; // Array para armazenar o histórico dos últimos números

function escolherVermelho() {
    jogar("vermelho");
}

function escolherPreto() {
    jogar("preto");
}

function jogar(escolhaUsuario) {
    var numeroComputador = Math.floor(Math.random() * 37);
    var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
    mensagem += `<img src="img/${numeroComputador}.png" alt="${numeroComputador}" width="50" height="50" class="iresult"><br>`;

    if (numeroComputador === 0) {
        mensagem += "Você perdeu!";
        derrotas++;
    } else {
        var corNumero = numeroComputador % 2 === 0 ? 'preto' : 'vermelho';

        // Verificação direta da escolha do usuário
        if (escolhaUsuario === corNumero) {
            mensagem += "Você ganhou!";
            vitorias++;
        } else {
            mensagem += "Você perdeu!";
            derrotas++;
        }
    }

    // Atualizar o histórico com o número atual
    atualizarHistorico(numeroComputador);

    atualizarRelatorio();
    atualizarHistoricoNaTela();

    document.getElementById("resultado").innerHTML = mensagem;
}

function atualizarRelatorio() {
    document.getElementById("vitorias").innerHTML = vitorias;
    document.getElementById("derrotas").innerHTML = derrotas;
}

function atualizarHistorico(numero) {
    // Adicionar o número ao início do histórico
    historico.unshift(numero);

    // Limitar o histórico a um tamanho máximo de 12 números
    if (historico.length > 12) {
        historico.pop();
    }
}

function atualizarHistoricoNaTela() {
    var listaHistorico = document.getElementById("historico-lista");
    listaHistorico.innerHTML = ''; // Limpa a lista antes de adicionar novos itens

    for (var i = 0; i < historico.length; i++) {
        var li = document.createElement("li");
        var img = document.createElement("img");
        img.src = `img/${historico[i]}.png`;
        img.alt = historico[i];
        li.appendChild(img);
        listaHistorico.appendChild(li);
    }
}

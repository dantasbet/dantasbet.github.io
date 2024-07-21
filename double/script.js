var vitorias = 0;
var derrotas = 0;
var historicoNumeros = [];

function escolherVermelho() {
    jogar("vermelho");
}

function escolherPreto() {
    jogar("preto");
}

function jogar(escolhaUsuario) {
    var numeroComputador = Math.floor(Math.random() * 37); // Gera um número entre 0 e 36
    var corComputador = numeroComputador === 0 ? null : (numeroComputador % 2 === 0 ? "preto" : "vermelho"); // Define a cor com base na paridade, ou null se for 0
    var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
    mensagem += `<img src="img/${numeroComputador}.png" alt="${numeroComputador}" width="50" height="50" class="iresult"><br>`;

    // Adiciona o número ao histórico
    if (historicoNumeros.length >= 12) {
        historicoNumeros.shift(); // Remove o número mais antigo se houver 12 números no histórico
    }
    historicoNumeros.push(numeroComputador);
    atualizarHistorico();

    // Verifica se o usuário ganhou ou perdeu
    if (numeroComputador === 0) {
        mensagem += "Você perdeu!";
        derrotas++;
    } else if (escolhaUsuario === corComputador) {
        mensagem += "Você ganhou!";
        vitorias++;
    } else {
        mensagem += "Você perdeu!";
        derrotas++;
    }

    atualizarRelatorio();
    document.getElementById("resultado").innerHTML = mensagem;
}

function atualizarRelatorio() {
    document.getElementById("vitorias").innerHTML = vitorias;
    document.getElementById("derrotas").innerHTML = derrotas;
}

function atualizarHistorico() {
    var historicoLista = document.getElementById("historico-lista");
    historicoLista.innerHTML = ""; // Limpa a lista atual
    historicoNumeros.forEach(function(numero) {
        var listItem = document.createElement("li");
        var img = document.createElement("img");
        img.src = `img/${numero}.png`; // Atualiza o caminho da imagem conforme necessário
        img.alt = numero;
        listItem.appendChild(img);
        historicoLista.appendChild(listItem);
    });
}

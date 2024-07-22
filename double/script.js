var vitorias = 0;
var derrotas = 0;
var saldo = 0; // Saldo inicial de R$0
var saldoDefinido = false; // Para verificar se o saldo foi definido
var historicoNumeros = [];

// Carrega o estado da sessão do localStorage ao carregar a página
function carregarEstado() {
    var saldoArmazenado = localStorage.getItem("saldo");
    var vitoriasArmazenadas = localStorage.getItem("vitorias");
    var derrotasArmazenadas = localStorage.getItem("derrotas");
    var historicoArmazenado = localStorage.getItem("historico");

    if (saldoArmazenado !== null) {
        saldo = parseFloat(saldoArmazenado);
        saldoDefinido = true;
        document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    }

    if (vitoriasArmazenadas !== null) {
        vitorias = parseInt(vitoriasArmazenadas);
    }

    if (derrotasArmazenadas !== null) {
        derrotas = parseInt(derrotasArmazenadas);
    }

    if (historicoArmazenado !== null) {
        historicoNumeros = JSON.parse(historicoArmazenado);
        atualizarHistorico();
    }

    atualizarRelatorio();
}

// Função para salvar o estado da sessão no localStorage
function salvarEstado() {
    localStorage.setItem("saldo", saldo);
    localStorage.setItem("vitorias", vitorias);
    localStorage.setItem("derrotas", derrotas);
    localStorage.setItem("historico", JSON.stringify(historicoNumeros));
}

// Função para definir o saldo inicial
function definirSaldo() {
    var inputSaldo = parseFloat(document.getElementById("inputSaldo").value);

    if (isNaN(inputSaldo) || inputSaldo <= 0) {
        alert("Por favor, insira um valor de saldo válido.");
        return;
    }

    saldo = inputSaldo;
    document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    document.getElementById("definir-saldo").style.display = "none"; // Esconde a seção de definir saldo
    saldoDefinido = true;
    salvarEstado(); // Salva o estado após definir o saldo
}

// Função para escolher a cor vermelho
function escolherVermelho() {
    jogar("vermelho");
}

// Função para escolher a cor preto
function escolherPreto() {
    jogar("preto");
}

// Função para jogar o jogo
function jogar(escolhaUsuario) {
    if (!saldoDefinido) {
        alert("Por favor, defina o saldo inicial antes de jogar.");
        return;
    }

    var valorAposta = parseFloat(document.getElementById("valorAposta").value);

    // Verifica se o valor da aposta é válido e não excede o saldo
    if (isNaN(valorAposta) || valorAposta <= 0) {
        alert("Por favor, insira um valor de aposta válido.");
        return;
    }
    if (valorAposta > saldo) {
        alert("Você não tem saldo suficiente para essa aposta.");
        return;
    }

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
        saldo -= valorAposta;
    } else if (escolhaUsuario === corComputador) {
        mensagem += "Você ganhou!";
        vitorias++;
        var ganho = valorAposta * 1;
        saldo += ganho;
        exibirGanho(ganho);
        exibirMensagemParabens(`Parabéns! Você ganhou R$${ganho.toFixed(2)}!`);
    } else {
        mensagem += "Você perdeu!";
        derrotas++;
        saldo -= valorAposta;
    }

    atualizarRelatorio();
    document.getElementById("resultado").innerHTML = mensagem;
    document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    salvarEstado(); // Salva o estado após cada jogo
}

// Função para atualizar o relatório de vitórias e derrotas
function atualizarRelatorio() {
    document.getElementById("vitorias").innerHTML = vitorias;
    document.getElementById("derrotas").innerHTML = derrotas;
}

// Função para atualizar o histórico dos números
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

// Função para exibir o ganho
function exibirGanho(ganho) {
    var ganhoElemento = document.getElementById("ganho");
    ganhoElemento.innerHTML = `Você ganhou R$${ganho.toFixed(2)}!`;
    ganhoElemento.style.display = "block";
    setTimeout(function() {
        ganhoElemento.style.display = "none";
    }, 3000); // Mostra o valor ganho por 3 segundos
}

// Função para exibir a mensagem de parabéns
function exibirMensagemParabens(mensagem) {
    var mensagemElemento = document.getElementById("mensagem-parabens");
    mensagemElemento.innerHTML = mensagem;
    mensagemElemento.style.display = "block";
    setTimeout(function() {
        mensagemElemento.style.display = "none";
    }, 3000); // Mostra a mensagem por 3 segundos
}

// Função para resetar a sessão
function resetarSessao() {
    localStorage.removeItem("saldo");
    localStorage.removeItem("vitorias");
    localStorage.removeItem("derrotas");
    localStorage.removeItem("historico");

    saldo = 0;
    saldoDefinido = false;
    vitorias = 0;
    derrotas = 0;
    historicoNumeros = [];

    document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    document.getElementById("definir-saldo").style.display = "block"; // Reexibe a seção de definir saldo
    document.getElementById("resultado").innerHTML = "";
    document.getElementById("ganho").innerHTML = "";
    document.getElementById("mensagem-parabens").style.display = "none";
    atualizarRelatorio();
    atualizarHistorico();
}

// Carrega o estado da sessão quando a página é carregada
window.onload = carregarEstado;

var vitorias = 0;
var derrotas = 0;
var saldo = 0; 
var saldoDefinido = false; 
var historicoNumeros = [];

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

function salvarEstado() {
    localStorage.setItem("saldo", saldo);
    localStorage.setItem("vitorias", vitorias);
    localStorage.setItem("derrotas", derrotas);
    localStorage.setItem("historico", JSON.stringify(historicoNumeros));
}

function definirSaldo() {
    var inputSaldo = parseFloat(document.getElementById("inputSaldo").value);

    if (isNaN(inputSaldo) || inputSaldo <= 0) {
        alert("Por favor, insira um valor de saldo válido.");
        return;
    }

    saldo = inputSaldo;
    document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    document.getElementById("definir-saldo").style.display = "none"; 
    saldoDefinido = true;
    salvarEstado(); 
}

function escolherVermelho() {
    jogar("vermelho");
}

function escolherPreto() {
    jogar("preto");
}

function jogar(escolhaUsuario) {
    if (!saldoDefinido) {
        alert("Por favor, defina o saldo inicial antes de jogar.");
        return;
    }

    var valorAposta = parseFloat(document.getElementById("valorAposta").value);

    if (isNaN(valorAposta) || valorAposta <= 0) {
        alert("Por favor, insira um valor de aposta válido.");
        return;
    }
    if (valorAposta > saldo) {
        alert("Você não tem saldo suficiente para essa aposta.");
        return;
    }

    var numeroComputador = Math.floor(Math.random() * 37); 
    var corComputador = numeroComputador === 0 ? null : (numeroComputador % 2 === 0 ? "preto" : "vermelho"); 
    var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
    mensagem += `<img src="img/${numeroComputador}.png" alt="${numeroComputador}" width="50" height="50" class="iresult"><br>`;

    if (historicoNumeros.length >= 12) {
        historicoNumeros.shift(); 
    }
    historicoNumeros.push(numeroComputador);
    atualizarHistorico();

    if (numeroComputador === 0) {
        mensagem += "Você perdeu!";
        derrotas++;
        saldo -= valorAposta;
    } else if (escolhaUsuario === corComputador) {
        mensagem += "Você ganhou!";
        vitorias++;
        var ganho = valorAposta * 1.00;
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
    salvarEstado(); 
}

function atualizarRelatorio() {
    document.getElementById("vitorias").innerHTML = vitorias;
    document.getElementById("derrotas").innerHTML = derrotas;
}

function atualizarHistorico() {
    var historicoLista = document.getElementById("historico-lista");
    historicoLista.innerHTML = ""; 
    historicoNumeros.forEach(function(numero) {
        var listItem = document.createElement("li");
        var img = document.createElement("img");
        img.src = `img/${numero}.png`; 
        img.alt = numero;
        listItem.appendChild(img);
        historicoLista.appendChild(listItem);
    });
}

function exibirGanho(ganho) {
    var ganhoElemento = document.getElementById("ganho");
    ganhoElemento.innerHTML = `Você ganhou R$${ganho.toFixed(2)}!`;
    ganhoElemento.style.display = "block";
    setTimeout(function() {
        ganhoElemento.style.display = "none";
    }, 3000); 
}

function exibirMensagemParabens(mensagem) {
    var mensagemElemento = document.getElementById("mensagem-parabens");
    mensagemElemento.innerHTML = mensagem;
    mensagemElemento.style.display = "block";
    setTimeout(function() {
        mensagemElemento.style.display = "none";
    }, 1500); 
}

function carregarEstado() {
    var saldoArmazenado = localStorage.getItem("saldo");
    var vitoriasArmazenadas = localStorage.getItem("vitorias");
    var derrotasArmazenadas = localStorage.getItem("derrotas");
    var historicoArmazenado = localStorage.getItem("historico");

    if (saldoArmazenado !== null) {
        saldo = parseFloat(saldoArmazenado);
        saldoDefinido = true;
        document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
        document.getElementById("definir-saldo").classList.add("oculto"); 
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
    document.getElementById("definir-saldo").classList.remove("oculto");
    document.getElementById("resultado").innerHTML = "";
    document.getElementById("ganho").innerHTML = "";
    document.getElementById("mensagem-parabens").style.display = "none";
    atualizarRelatorio();
    atualizarHistorico();
}


window.onload = carregarEstado;

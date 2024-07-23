var vitorias = 0;
var derrotas = 0;
var saldo = 0;
var saldoDefinido = false;
var historicoNumeros = [];
var cronometroIntervalo;
var tempoRestante = 10;
var apostaFeita = false;
var escolhaUsuario = '';

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
    iniciarCronometro();  // Inicia o cronômetro quando a página é carregada
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
    if (apostaFeita) {
        alert("Você já fez uma aposta nesta rodada.");
        return;
    }

    escolhaUsuario = "vermelho";
    apostaFeita = true;

    // Torna os botões semitransparentes e desativa-os
    document.getElementById("btnVermelho").classList.add("desativado");
    document.getElementById("btnPreto").classList.add("desativado");
}

function escolherPreto() {
    if (apostaFeita) {
        alert("Você já fez uma aposta nesta rodada.");
        return;
    }

    escolhaUsuario = "preto";
    apostaFeita = true;

    // Torna os botões semitransparentes e desativa-os
    document.getElementById("btnPreto").classList.add("desativado");
    document.getElementById("btnVermelho").classList.add("desativado");
}

function dobrarAposta() {
    var valorApostaInput = document.getElementById("valorAposta");
    var valorAposta = parseFloat(valorApostaInput.value);

    if (!isNaN(valorAposta) && valorAposta > 0) {
        valorAposta *= 2;
        valorApostaInput.value = valorAposta.toFixed(2);
    } else {
        alert("Por favor, insira um valor de aposta válido para dobrar.");
    }
}

function dividirAposta() {
    var valorApostaInput = document.getElementById("valorAposta");
    var valorAposta = parseFloat(valorApostaInput.value);

    if (!isNaN(valorAposta) && valorAposta > 0) {
        valorAposta /= 2;
        valorApostaInput.value = valorAposta.toFixed(2);
    } else {
        alert("Por favor, insira um valor de aposta válido para dividir.");
    }
}

function iniciarCronometro() {
    tempoRestante = 10;
    document.getElementById("contador").innerHTML = `Tempo restante: ${tempoRestante}s`;

    cronometroIntervalo = setInterval(function () {
        tempoRestante--;

        document.getElementById("contador").innerHTML = `Tempo restante: ${tempoRestante}s`;

        if (tempoRestante <= 0) {
            clearInterval(cronometroIntervalo);
            processarAposta();
            iniciarCronometro(); // Reinicia o cronômetro para a próxima rodada
        }
    }, 1000);
}

function processarAposta() {
    if (!saldoDefinido) {
        alert("Por favor, defina o saldo inicial antes de jogar.");
        return;
    }

    var valorAposta = parseFloat(document.getElementById("valorAposta").value);

    if (apostaFeita && (isNaN(valorAposta) || valorAposta <= 0)) {
        alert("Por favor, insira um valor de aposta válido.");
        return;
    }

    if (apostaFeita && valorAposta > saldo) {
        alert("Você não tem saldo suficiente para essa aposta.");
        return;
    }

    var numeroComputador = Math.floor(Math.random() * 37);
    var corComputador = numeroComputador === 0 ? null : (numeroComputador % 2 === 0 ? "preto" : "vermelho");
    var mensagem = `Número sorteado: ${numeroComputador}.<br>`;
    mensagem += `<img src="img/${numeroComputador}.png" alt="${numeroComputador}" width="50" height="50" class="iresult"><br>`;

    if (historicoNumeros.length >= 12) {
        historicoNumeros.shift();
    }
    historicoNumeros.push(numeroComputador);
    atualizarHistorico();

    if (apostaFeita) {
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
    } else {
        mensagem += "Nenhuma aposta feita.";
    }

    if (saldo <= 0) {
        saldo = 0;
        alert("Seu saldo acabou. Por favor, defina um novo saldo.");
        document.getElementById("definir-saldo").style.display = "block";
    }

    apostaFeita = false; // Resetar a apostaFeita
    escolhaUsuario = ''; // Resetar a escolha do usuário

    document.getElementById("resultado").innerHTML = mensagem;
    document.getElementById("saldo").innerHTML = `R$${saldo.toFixed(2)}`;
    document.getElementById("btnPreto").classList.remove("desativado");
    document.getElementById("btnVermelho").classList.remove("desativado");

    atualizarRelatorio();
    salvarEstado();
}

function atualizarHistorico() {
    var historicoLista = document.getElementById("historico-lista");
    historicoLista.innerHTML = "";

    for (var i = 0; i < historicoNumeros.length; i++) {
        var numero = historicoNumeros[i];
        var cor = numero === 0 ? "verde" : (numero % 2 === 0 ? "preto" : "vermelho");

        var li = document.createElement("li");
        var img = document.createElement("img");
        img.src = `img/${numero}.png`;
        img.alt = numero;
        img.style.borderColor = cor;
        li.appendChild(img);
        historicoLista.appendChild(li);
    }
}

function atualizarRelatorio() {
    document.getElementById("vitorias").innerText = vitorias;
    document.getElementById("derrotas").innerText = derrotas;
}

function exibirGanho(ganho) {
    var ganhoElemento = document.getElementById("ganho");
    ganhoElemento.innerText = `Você ganhou R$${ganho.toFixed(2)}!`;
    ganhoElemento.style.color = "green";
    setTimeout(function () {
        ganhoElemento.innerText = "";
    }, 5000);
}

function exibirMensagemParabens(mensagem) {
    var mensagemElemento = document.getElementById("mensagem-parabens");
    mensagemElemento.innerHTML = mensagem;
    mensagemElemento.style.display = "block";
    setTimeout(function () {
        mensagemElemento.style.display = "none";
    }, 3000);
}

function resetarSessao() {
    saldo = 0;
    vitorias = 0;
    derrotas = 0;
    saldoDefinido = false;
    historicoNumeros = [];
    localStorage.clear();
    document.getElementById("saldo").innerHTML = "R$0,00";
    document.getElementById("resultado").innerHTML = "";
    document.getElementById("vitorias").innerHTML = "0";
    document.getElementById("derrotas").innerHTML = "0";
    document.getElementById("historico-lista").innerHTML = "";
    document.getElementById("definir-saldo").style.display = "block";
}

window.onload = carregarEstado;

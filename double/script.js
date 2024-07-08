function escolherPar() {
            jogar("par");
        }

        function escolherImpar() {
            jogar("ímpar");
        }

        function jogar(escolhaUsuario) {
            var numeroComputador = Math.floor(Math.random() * 14) + 1;

            var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
            mensagem += `O numero sorteado foi ${numeroComputador}.<br><br>`;

            if ((escolhaUsuario === "par" && numeroComputador % 2 === 0) ||
                (escolhaUsuario === "ímpar" && numeroComputador % 2 !== 0)) {
                mensagem += "Você ganhou!";
            } else {
                mensagem += "Você perdeu!";
            }

            document.getElementById("resultado").innerHTML = mensagem;
        }

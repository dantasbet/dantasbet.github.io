function escolherPar() {
            jogar("par");
        }

        function escolherImpar() {
            jogar("ímpar");
        }

        function jogar(escolhaUsuario) {
            // Gerar número aleatório de 1 a 14 para o computador
            var numeroComputador = Math.floor(Math.random() * 14) + 1;

            // Mostrar escolhas e resultado
            var mensagem = `Você escolheu ${escolhaUsuario}.<br>`;
            mensagem += `O computador escolheu ${numeroComputador}.<br><br>`;

            // Determinar se o usuário ganhou ou perdeu
            if ((escolhaUsuario === "par" && numeroComputador % 2 === 0) ||
                (escolhaUsuario === "ímpar" && numeroComputador % 2 !== 0)) {
                mensagem += "Você ganhou!";
            } else {
                mensagem += "Você perdeu!";
            }

            document.getElementById("resultado").innerHTML = mensagem;
        }

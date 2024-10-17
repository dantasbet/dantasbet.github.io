const API_KEY = "8603c4850f36917a0565bddde8199bfb"; // Coloque sua chave de API aqui
const ligaSelect = document.getElementById('ligaSelect');
const carregarJogosButton = document.getElementById('carregarJogos');
const jogosList = document.getElementById('jogosList');
const dadosJogo = document.getElementById('dadosJogo');
const resultado = document.getElementById('resultado');

// Função para buscar ligas com jogos
async function buscarLigas() {
    const response = await fetch("https://v3.football.api-sports.io/leagues", {
        headers: {
            "x-apisports-key": API_KEY
        }
    });

    if (response.ok) {
        const data = await response.json();
        data.response.forEach(liga => {
            const option = document.createElement('option');
            option.value = liga.id;
            option.textContent = liga.name;
            ligaSelect.appendChild(option);
        });
    } else {
        console.error('Erro ao buscar ligas:', response.status);
    }
}

// Função para buscar jogos de uma liga específica
async function buscarJogos(ligaId) {
    const hoje = new Date().toISOString().split('T')[0];
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?league=${ligaId}&date=${hoje}`, {
        headers: {
            "x-apisports-key": API_KEY
        }
    });

    if (response.ok) {
        const data = await response.json();
        jogosList.innerHTML = ''; // Limpa a lista de jogos
        data.response.forEach(jogo => {
            const li = document.createElement('li');
            li.textContent = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
            li.addEventListener('click', () => mostrarDadosJogo(jogo));
            jogosList.appendChild(li);
        });
    } else {
        console.error('Erro ao buscar jogos:', response.status);
    }
}

// Função para mostrar dados do jogo
async function mostrarDadosJogo(jogo) {
    const ultimosJogosHome = await buscarUltimosJogos(jogo.teams.home.id);
    const ultimosJogosAway = await buscarUltimosJogos(jogo.teams.away.id);

    // Calcular médias aqui, e montar a resposta
    resultado.innerHTML = `
        <p>Média de Gols - Time A: ${calcularMediaGols(ultimosJogosHome)}</p>
        <p>Média de Gols - Time B: ${calcularMediaGols(ultimosJogosAway)}</p>
        <!-- Adicione as outras médias aqui -->
    `;
    dadosJogo.style.display = 'block';
}

// Função para buscar últimos jogos de um time
async function buscarUltimosJogos(teamId) {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?team=${teamId}&last=5`, {
        headers: {
            "x-apisports-key": API_KEY
        }
    });

    if (response.ok) {
        return await response.json();
    } else {
        console.error('Erro ao buscar últimos jogos:', response.status);
        return [];
    }
}

// Calcular média de gols
function calcularMediaGols(jogos) {
    const totalGols = jogos.reduce((total, jogo) => total + jogo.goals.home + jogo.goals.away, 0);
    return (totalGols / jogos.length).toFixed(2) || 0; // Retorna 0 se não houver jogos
}

// Carregar ligas ao iniciar
document.addEventListener('DOMContentLoaded', buscarLigas);
carregarJogosButton.addEventListener('click', () => buscarJogos(ligaSelect.value));

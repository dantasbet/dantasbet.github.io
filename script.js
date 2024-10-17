const apiKey = '8603c4850f36917a0565bddde8199bfb'; // Coloque sua chave aqui.
const ligaSelect = document.getElementById('liga-select');
const jogoSelect = document.getElementById('jogo-select');
const jogosContainer = document.getElementById('jogos-container');
const analiseContainer = document.getElementById('analise-container');
const resultadosDiv = document.getElementById('resultados');

// Função para buscar ligas com jogos no dia atual
async function buscarLigas() {
    const hoje = new Date().toISOString().split('T')[0];
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${hoje}`, {
        headers: { 'x-apisports-key': apiKey }
    });
    const data = await response.json();
    const ligas = [...new Set(data.response.map(fixture => fixture.league))];

    ligas.forEach(liga => {
        const option = document.createElement('option');
        option.value = liga.id;
        option.textContent = liga.name;
        ligaSelect.appendChild(option);
    });
}

// Função para buscar jogos da liga selecionada
async function buscarJogos(ligaId) {
    const hoje = new Date().toISOString().split('T')[0];
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${hoje}&league=${ligaId}`, {
        headers: { 'x-apisports-key': apiKey }
    });
    const data = await response.json();

    jogoSelect.innerHTML = '<option value="">Selecione um Jogo</option>'; // Resetar opções

    data.response.forEach(jogo => {
        const option = document.createElement('option');
        option.value = jogo.fixture.id;
        option.textContent = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
        jogoSelect.appendChild(option);
    });

    jogosContainer.style.display = 'block';
}

// Função para buscar e calcular as médias dos últimos 5 jogos de cada time
async function calcularMedias(fixtureId) {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
        headers: { 'x-apisports-key': apiKey }
    });
    const data = await response.json();
    const fixture = data.response[0];
    const times = [fixture.teams.home.id, fixture.teams.away.id];

    let resultados = '';

    for (const time of times) {
        const statsResponse = await fetch(`https://v3.football.api-sports.io/teams/statistics?team=${time}&season=2023`, {
            headers: { 'x-apisports-key': apiKey }
        });
        const stats = await statsResponse.json();

        const ultimos5 = stats.response.fixtures.last_5;
        const mediaGols = ultimos5.goals / 5;
        const mediaEscanteios = ultimos5.corners / 5;
        const mediaCartoes = ultimos5.cards / 5;
        const ambasMarcaram = ultimos5.both_teams_scored ? 'Sim' : 'Não';

        resultados += `
            <h3>${fixture.teams.home.name}</h3>
            <p>Média de Gols: ${mediaGols.toFixed(2)}</p>
            <p>Média de Escanteios: ${mediaEscanteios.toFixed(2)}</p>
            <p>Média de Cartões: ${mediaCartoes.toFixed(2)}</p>
            <p>Ambas Marcaram: ${ambasMarcaram}</p>
        `;
    }

    resultadosDiv.innerHTML = resultados;
    analiseContainer.style.display = 'block';
}

// Eventos
ligaSelect.addEventListener('change', () => {
    const ligaId = ligaSelect.value;
    if (ligaId) buscarJogos(ligaId);
});

jogoSelect.addEventListener('change', () => {
    const fixtureId = jogoSelect.value;
    if (fixtureId) calcularMedias(fixtureId);
});

// Inicialização
buscarLigas();

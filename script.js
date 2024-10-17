const apiKey = '8603c4850f36917a0565bddde8199bfb'; // Substitua pela sua chave API

const dataSelect = document.getElementById('data-select');
const ligaSelect = document.getElementById('liga-select');
const jogoSelect = document.getElementById('jogo-select');
const analiseContainer = document.getElementById('analise-container');
const analiseDados = document.getElementById('analise-dados');

// Busca ligas automaticamente para a data selecionada
dataSelect.addEventListener('change', async () => {
    const data = dataSelect.value;
    if (data) await buscarLigas(data);
});

async function buscarLigas(data) {
    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${data}`, {
            headers: { 'x-apisports-key': apiKey }
        });
        const dataLigas = await response.json();

        const ligas = [...new Set(dataLigas.response.map(jogo => jogo.league))];

        ligaSelect.innerHTML = '<option value="">Selecione uma Liga</option>';
        ligas.forEach(liga => {
            const option = document.createElement('option');
            option.value = liga.id;
            option.textContent = liga.name;
            ligaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao buscar ligas:', error);
    }
}

ligaSelect.addEventListener('change', async () => {
    const ligaId = ligaSelect.value;
    const data = dataSelect.value;
    if (ligaId) await buscarJogos(ligaId, data);
});

async function buscarJogos(ligaId, data) {
    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?league=${ligaId}&date=${data}`, {
            headers: { 'x-apisports-key': apiKey }
        });
        const dataJogos = await response.json();

        jogoSelect.innerHTML = '<option value="">Selecione um Jogo</option>';
        dataJogos.response.forEach(jogo => {
            const option = document.createElement('option');
            option.value = jogo.fixture.id;
            option.textContent = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
            jogoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao buscar jogos:', error);
    }
}

jogoSelect.addEventListener('change', async () => {
    const jogoId = jogoSelect.value;
    if (jogoId) await calcularMedias(jogoId);
});

async function calcularMedias(jogoId) {
    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${jogoId}`, {
            headers: { 'x-apisports-key': apiKey }
        });
        const dadosJogo = await response.json();
        const [homeTeam, awayTeam] = [dadosJogo.response[0].teams.home.id, dadosJogo.response[0].teams.away.id];

        const homeStats = await buscarUltimosJogos(homeTeam);
        const awayStats = await buscarUltimosJogos(awayTeam);

        const analise = `
            <p><strong>Médias do Time Casa:</strong></p>
            <p>Cartões: ${homeStats.mediaCartoes}</p>
            <p>Escanteios: ${homeStats.mediaEscanteios}</p>
            <p>Gols: ${homeStats.mediaGols}</p>
            <p>Vitórias: ${homeStats.vitorias}</p>
            <p>Empates: ${homeStats.empates}</p>
            <p>Derrotas: ${homeStats.derrotas}</p>
            <p>Ambas Marcam: ${homeStats.ambasMarcam}</p>

            <p><strong>Médias do Time Visitante:</strong></p>
            <p>Cartões: ${awayStats.mediaCartoes}</p>
            <p>Escanteios: ${awayStats.mediaEscanteios}</p>
            <p>Gols: ${awayStats.mediaGols}</p>
            <p>Vitórias: ${awayStats.vitorias}</p>
            <p>Empates: ${awayStats.empates}</p>
            <p>Derrotas: ${awayStats.derrotas}</p>
            <p>Ambas Marcam: ${awayStats.ambasMarcam}</p>
        `;

        analiseDados.innerHTML = analise;
        analiseContainer.style.display = 'block';
    } catch (error) {
        console.error('Erro ao calcular médias:', error);
    }
}

async function buscarUltimosJogos(teamId) {
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?team=${teamId}&last=5`, {
        headers: { 'x-apisports-key': apiKey }
    });
    const data = await response.json();

    let cartoes = 0, escanteios = 0, gols = 0;
    let vitorias = 0, empates = 0, derrotas = 0, ambasMarcam = 0;

    data.response.forEach(jogo => {
        cartoes += jogo.statistics.cards.total;
        escanteios += jogo.statistics.corners.total;
        gols += jogo.goals.for;
        
        if (jogo.goals.for > jogo.goals.against) vitorias++;
        else if (jogo.goals.for === jogo.goals.against) empates++;
        else derrotas++;

        if (jogo.goals.for > 0 && jogo.goals.against > 0) ambasMarcam++;
    });

    return {
        mediaCartoes: (cartoes / 5).toFixed(2),
        mediaEscanteios: (escanteios / 5).toFixed(2),
        mediaGols: (gols / 5).toFixed(2),
        vitorias, empates, derrotas, ambasMarcam
    };
}

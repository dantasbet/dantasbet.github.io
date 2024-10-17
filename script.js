const apiKey = 'SUA_API_KEY'; // Substitua pela sua chave API

const ligaSelect = document.getElementById('liga-select');
const jogoSelect = document.getElementById('jogo-select');
const jogosContainer = document.getElementById('jogos-container');
const analiseContainer = document.getElementById('analise-container');
const analiseDados = document.getElementById('analise-dados');

// Carregar ligas automaticamente ao entrar no site (com a data atual)
window.addEventListener('load', async () => {
    const hoje = new Date().toISOString().split('T')[0]; // Data atual no formato YYYY-MM-DD
    await buscarLigas(hoje);
});

// Buscar as ligas que têm jogos na data atual
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

        ligaSelect.addEventListener('change', () => {
            const ligaId = ligaSelect.value;
            if (ligaId) buscarJogos(ligaId, data);
        });
    } catch (error) {
        console.error('Erro ao buscar ligas:', error);
    }
}

// Buscar os jogos disponíveis para a liga escolhida
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

        jogosContainer.style.display = 'block';

        jogoSelect.addEventListener('change', () => {
            const jogoId = jogoSelect.value;
            if (jogoId) calcularMedias(jogoId);
        });
    } catch (error) {
        console.error('Erro ao buscar jogos:', error);
    }
}

// Calcular as médias dos últimos 5 jogos para o jogo escolhido
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

// Buscar os últimos 5 jogos de um time específico
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

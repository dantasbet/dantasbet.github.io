const API_KEY = '8603c4850f36917a0565bddde8199bfb';  // Insira sua chave da API-Football
const BASE_URL = 'https://v3.football.api-sports.io';

// Elementos da interface
const listaLigas = document.getElementById('lista-ligas');
const listaJogos = document.getElementById('lista-jogos');
const dadosJogo = document.getElementById('dados-jogo');
const secaoJogos = document.getElementById('jogos');
const secaoAnalise = document.getElementById('analise');
const inputData = document.getElementById('data');

// Função para fazer requisições à API
async function fetchAPI(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY },
    });

    if (!response.ok) throw new Error(`Erro: ${response.statusText}`);

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    alert('Erro ao carregar dados. Verifique sua API Key ou tente mais tarde.');
    return [];
  }
}

// Carregar ligas com base na data selecionada
async function carregarLigas(dataEscolhida) {
  const jogosHoje = await fetchAPI(`/fixtures?date=${dataEscolhida}`);

  if (jogosHoje.length === 0) {
    listaLigas.innerHTML = '<li>Nenhuma liga com jogos nessa data.</li>';
    return;
  }

  const ligasUnicas = [...new Map(jogosHoje.map(jogo => [jogo.league.id, jogo.league])).values()];

  listaLigas.innerHTML = '';
  ligasUnicas.forEach(league => {
    const li = document.createElement('li');
    li.textContent = league.name;
    li.onclick = () => carregarJogos(league.id, dataEscolhida);
    listaLigas.appendChild(li);
  });
}

// Carregar jogos de uma liga específica
async function carregarJogos(leagueId, dataEscolhida) {
  secaoJogos.style.display = 'block';
  const jogos = await fetchAPI(`/fixtures?league=${leagueId}&date=${dataEscolhida}`);

  listaJogos.innerHTML = '';
  jogos.forEach(jogo => {
    const li = document.createElement('li');
    li.textContent = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
    li.onclick = () => mostrarAnalise(jogo);
    listaJogos.appendChild(li);
  });
}

// Mostrar análise do jogo selecionado
async function mostrarAnalise(jogo) {
  secaoAnalise.style.display = 'block';
  const [homeStats, awayStats] = await Promise.all([
    fetchAPI(`/teams/statistics?team=${jogo.teams.home.id}&league=${jogo.league.id}&season=2023`),
    fetchAPI(`/teams/statistics?team=${jogo.teams.away.id}&league=${jogo.league.id}&season=2023`),
  ]);

  const analiseHTML = `
    <h3>${jogo.teams.home.name} vs ${jogo.teams.away.name}</h3>
    <p><strong>Média de Cartões:</strong> ${calcularMedia(homeStats.cards)} / ${calcularMedia(awayStats.cards)}</p>
    <p><strong>Média de Gols:</strong> ${calcularMedia(homeStats.goals)} / ${calcularMedia(awayStats.goals)}</p>
    <p><strong>Média de Escanteios:</strong> ${calcularMedia(homeStats.corners)} / ${calcularMedia(awayStats.corners)}</p>
    <p><strong>Vitórias / Derrotas / Empates:</strong> ${homeStats.wins} / ${homeStats.losses} / ${homeStats.draws}</p>
    <p><strong>Ambos Marcaram:</strong> ${contarAmbosMarcaram(homeStats)} vezes / ${contarAmbosMarcaram(awayStats)} vezes</p>
  `;

  dadosJogo.innerHTML = analiseHTML;
}

// Funções auxiliares para cálculo
function calcularMedia(stats) {
  const total = stats.reduce((acc, val) => acc + val, 0);
  return (total / stats.length).toFixed(2);
}

function contarAmbosMarcaram(stats) {
  return stats.filter(jogo => jogo.both_teams_scored).length;
}

// Adicionar evento ao input de data
inputData.addEventListener('change', (e) => {
  const dataEscolhida = e.target.value;
  carregarLigas(dataEscolhida);
});

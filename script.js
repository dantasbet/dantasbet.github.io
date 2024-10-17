const API_KEY = '8603c4850f36917a0565bddde8199bfb';  // Insira sua chave da API-Football
const BASE_URL = 'https://v3.football.api-sports.io';

// Elementos da interface
const listaLigas = document.getElementById('lista-ligas');
const listaJogos = document.getElementById('lista-jogos');
const dadosJogo = document.getElementById('dados-jogo');
const secaoJogos = document.getElementById('jogos');
const secaoAnalise = document.getElementById('analise');
const inputData = document.getElementById('data');
const secaoLigas = document.getElementById('ligas');

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

// Função para carregar ligas com base na data
async function carregarLigas(dataEscolhida) {
  const jogosHoje = await fetchAPI(`/fixtures?date=${dataEscolhida}`);

  if (jogosHoje.length === 0) {
    listaLigas.innerHTML = '<li>Nenhuma liga com jogos nesta data.</li>';
    secaoLigas.classList.remove('hidden');
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

  secaoLigas.classList.remove('hidden');
}

// Função para carregar jogos de uma liga específica
async function carregarJogos(leagueId, dataEscolhida) {
  secaoJogos.classList.remove('hidden');
  const jogos = await fetchAPI(`/fixtures?league=${leagueId}&date=${dataEscolhida}`);

  listaJogos.innerHTML = '';
  jogos.forEach(jogo => {
    const li = document.createElement('li');
    li.textContent = `${jogo.teams.home.name} vs ${jogo.teams.away.name}`;
    li.onclick = () => mostrarAnalise(jogo);
    listaJogos.appendChild(li);
  });
}

// Função para mostrar análise do jogo selecionado
async function mostrarAnalise(jogo) {
  secaoAnalise.classList.remove('hidden');
  const [homeStats, awayStats] = await Promise.all([
    fetchAPI(`/teams/statistics?team=${jogo.teams.home.id}&league=${jogo.league.id}&season=2023`),
    fetchAPI(`/teams/statistics?team=${jogo.teams.away.id}&league=${jogo.league.id}&season=2023`),
  ]);

  dadosJogo.innerHTML = `
    <h3>${jogo.teams.home.name} vs ${jogo.teams.away.name}</h3>
    <p><strong>Média de Cartões:</strong> ${calcularMedia(homeStats.cards)} / ${calcularMedia(awayStats.cards)}</p>
    <p><strong>Média de Gols:</strong> ${calcularMedia(homeStats.goals)} / ${calcularMedia(awayStats.goals)}</p>
  `;
}

// Funções auxiliares para cálculo
function calcularMedia(stats) {
  const total = stats.reduce((acc, val) => acc + val, 0);
  return (total / stats.length).toFixed(2);
}

// Evento para selecionar a data e carregar ligas
inputData.addEventListener('change', (e) => {
  const dataEscolhida = e.target.value;
  carregarLigas(dataEscolhida);
});

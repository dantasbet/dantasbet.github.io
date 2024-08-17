let runningCount = 0;
let cardHistory = [];
let totalCards = 8 * 52;  // Total de cartas no começo do jogo
let cardsDealt = 0;

const cardValues = {
    "2": 1,
    "3": 1,
    "4": 2,
    "5": 2,
    "6": 2,
    "7": 1,
    "8": 0,
    "9": -1,
    "10": -2,
    "J": -2,
    "Q": -2,
    "K": -2,
    "A": -2
};

document.querySelectorAll('.card-button').forEach(button => {
    button.addEventListener('click', () => {
        const cardValue = button.getAttribute('data-value');
        runningCount += cardValues[cardValue];
        cardHistory.push(cardValue);
        cardsDealt++;
        updateCounts();
    });
});

document.getElementById('reset').addEventListener('click', () => {
    runningCount = 0;
    cardHistory = [];
    totalCards = 8 * 52;
    cardsDealt = 0;
    updateCounts();
});

function updateCounts() {
    const decksRemaining = ((totalCards - cardsDealt) / 52).toFixed(2);  // Cálculo dos baralhos restantes
    const trueCount = (runningCount / decksRemaining).toFixed(2);
    
    document.getElementById('runningCount').textContent = runningCount;
    document.getElementById('trueCount').textContent = trueCount;
    document.getElementById('decksRemaining').textContent = decksRemaining;
    
    // Atualizar o histórico
    const cardHistoryContent = document.getElementById('cardHistory');
    cardHistoryContent.textContent = cardHistory.join(' ');

    // Atualizar o status da contagem
    const countStatus = document.getElementById('countStatus');
    if (trueCount >= 2) {
        countStatus.textContent = 'Bom';
        countStatus.className = 'status good';
    } else if (trueCount >= 0) {
        countStatus.textContent = 'Moderado';
        countStatus.className = 'status moderate';
    } else if (trueCount >= -2) {
        countStatus.textContent = 'Fraco';
        countStatus.className = 'status weak';
    } else {
        countStatus.textContent = 'Rum';
        countStatus.className = 'status rum';
    }
}

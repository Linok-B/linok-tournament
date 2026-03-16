// js/app.js (Additions and changes)
import { Tournament } from './engine/tournament.js';
import { saveTournamentLocally, loadTournamentLocally, clearLocalData } from './store/localData.js';
import { renderBracket } from './ui/renderer.js';

let currentTournament = new Tournament();

const savedData = loadTournamentLocally();
if (savedData) {
    // Restore state AND correct prototypes
    currentTournament = Object.assign(new Tournament(), savedData);
}

updateUI();

// Add Player Event
document.getElementById('btn-add-player').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const eloInput = document.getElementById('player-elo');
    if (nameInput.value.trim() === '') return;

    const added = currentTournament.addPlayer(nameInput.value, eloInput.value);
    if (!added) alert("Cannot add players after tournament has started!");
    
    nameInput.value = '';
    saveTournamentLocally(currentTournament);
    updateUI();
});

// Start Tournament Event
document.getElementById('btn-start-elim').addEventListener('click', () => {
    if (currentTournament.status !== "setup") {
        alert("Tournament is already active!");
        return;
    }

    if (currentTournament.startSingleElimination()) {
        saveTournamentLocally(currentTournament);
        updateUI();
    }
});

// Reset Button Event
document.getElementById('btn-clear-data').addEventListener('click', () => {
    if(confirm("Are you sure? This deletes the tournament.")) {
        clearLocalData();
        currentTournament = new Tournament(); 
        updateUI();
    }
});

// Master UI Sync
function updateUI() {
    // We pass the whole tournament object so renderer knows if it's active or setup
    renderBracket(currentTournament, 'player-list-container');
}

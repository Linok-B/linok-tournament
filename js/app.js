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

    if (currentTournament.startTournament()) {
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
    // 1. Capture current unsaved input values before wiping the screen
    const inputs = document.querySelectorAll('#player-list-container input[type="number"]');
    const draftScores = {};
    inputs.forEach(input => { draftScores[input.id] = input.value; });

    // 2. Wipe and re-render the whole board
    renderBracket(currentTournament, 'player-list-container');

    // 3. Put the unsaved values back into the new inputs
    for (const [id, value] of Object.entries(draftScores)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }
}

document.getElementById('player-list-container').addEventListener('click', (e) => {
    
    // 1. Handle "Submit Score" Button
    if (e.target && e.target.classList.contains('btn-report')) {
        const matchId = e.target.getAttribute('data-matchid');
        const score1 = document.getElementById(`s1-${matchId}`).value;
        const score2 = document.getElementById(`s2-${matchId}`).value;

        const success = currentTournament.reportMatchScore(matchId, score1, score2);
        if (success) {
            saveTournamentLocally(currentTournament);
            updateUI();
        } else {
            alert("Error reporting score.");
        }
    }

    // 2. Handle "Remove Player (X)" Button
    if (e.target && e.target.classList.contains('btn-remove-player')) {
        const playerId = e.target.getAttribute('data-id');
        
        if (currentTournament.removePlayer(playerId)) {
            saveTournamentLocally(currentTournament);
            updateUI();
        }
    }
});

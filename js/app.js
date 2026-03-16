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

// We use Event Delegation because the score buttons are created dynamically by renderer.js
document.getElementById('player-list-container').addEventListener('click', (e) => {
    // Check if the clicked element is a Submit Score button
    if (e.target && e.target.classList.contains('btn-report')) {
        const matchId = e.target.getAttribute('data-matchid');
        
        // Grab the inputs specific to this match
        const score1 = document.getElementById(`s1-${matchId}`).value;
        const score2 = document.getElementById(`s2-${matchId}`).value;

        if (score1 === score2) {
            alert("No ties allowed in Single Elimination!");
            return;
        }

        // Send to Engine
        const success = currentTournament.reportMatchScore(matchId, score1, score2);
        
        if (success) {
            saveTournamentLocally(currentTournament);
            updateUI();
        } else {
            alert("Error reporting score.");
        }
    }
});

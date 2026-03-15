// Notice the .js extensions! Essential for vanilla JS modules in the browser.
import { Tournament } from './engine/tournament.js';
import { calculateElo } from './engine/systems/elo.js';
import { saveTournamentLocally, loadTournamentLocally, clearLocalData } from './store/localData.js';
import { renderPlayerList } from './ui/renderer.js';

// 1. Initialize State
let currentTournament = new Tournament();

// 2. Load existing data if they refreshed the page
const savedData = loadTournamentLocally();
if (savedData) {
    // Restore state
    currentTournament.players = savedData.players;
    currentTournament.stages = savedData.stages;
    currentTournament.settings = savedData.settings;
}

// 3. Initial Render
updateUI();

// --- EVENT LISTENERS ---

// Add Player Button
document.getElementById('btn-add-player').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const eloInput = document.getElementById('player-elo');
    
    if (nameInput.value.trim() === '') return;

    // Tell the engine to add the player
    currentTournament.addPlayer(nameInput.value, eloInput.value);
    
    // Clear the input
    nameInput.value = '';
    
    // Save and update
    saveTournamentLocally(currentTournament);
    updateUI();
});

// Reset Button
document.getElementById('btn-clear-data').addEventListener('click', () => {
    if(confirm("Are you sure? This deletes the tournament.")) {
        clearLocalData();
        currentTournament = new Tournament(); // Reset engine
        updateUI();
    }
});

// Master function to sync UI with Engine State
function updateUI() {
    renderPlayerList(currentTournament.players, 'player-list-container');
}

// Quick Test of our Custom Math Engine (Check your browser console!)
console.log("Testing ELO Engine: Player A (1200) beats Player B (1200)");
console.log(calculateElo(1200, 1200, 1)); // 1 means Player A won

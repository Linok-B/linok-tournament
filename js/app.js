import { Tournament } from './engine/tournament.js';
import { saveTournamentLocally, loadTournamentLocally, clearLocalData } from './store/localData.js';
import { renderBracket, renderStandings } from './ui/renderer.js';
import { exportTournamentJSON, importTournamentJSON } from './store/export.js';

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

document.getElementById('btn-export-data').addEventListener('click', () => {
    exportTournamentJSON(currentTournament);
});

// Import Button (Clicks the hidden file input)
document.getElementById('btn-import-data').addEventListener('click', () => {
    // We only allow import during the setup phase to prevent accidental overwrites mid-tournament
    if (currentTournament.status !== "setup") {
        if (!confirm("Tournament is currently active! Importing will overwrite ALL current progress. Continue?")) {
            return;
        }
    }
    document.getElementById('file-import').click();
});

// Handle the File Selection
document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    importTournamentJSON(file, (success, parsedData) => {
        if (success) {
            // Restore state AND ensure it adopts the Tournament class methods
            currentTournament = Object.assign(new Tournament(), parsedData);
            saveTournamentLocally(currentTournament);
            
            // Reset the tab view to the latest stage
            window.viewingStageIndex = currentTournament.stages.length - 1;
            updateUI();
            
            alert("Tournament successfully imported!");
        } else {
            alert(parsedData); // Shows the error message
        }
        
        // Clear the input so the same file can be selected again if needed
        e.target.value = ''; 
    });
});

// Master UI Sync
function updateUI() {
    const inputs = document.querySelectorAll('#player-list-container input[type="number"]');
    const draftScores = {};
    inputs.forEach(input => { draftScores[input.id] = input.value; });

    // Render the Bracket
    renderBracket(currentTournament, 'player-list-container');

    // NEW: Render the Standings ONLY if the tournament has started
    const standingsDiv = document.getElementById('standings-container');
    if (currentTournament.status !== "setup") {
        renderStandings(currentTournament.players, 'standings-container');
    } else {
        standingsDiv.innerHTML = ''; // Clear it if in setup phase
    }

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

    // 3. Handle Stage Tab Clicks
    if (e.target && e.target.classList.contains('btn-stage-tab')) {
        const tabIndex = parseInt(e.target.getAttribute('data-index'));
        window.viewingStageIndex = tabIndex; // Set the global viewing index
        updateUI(); // Redraw the screen
    }

    // 4. Handle "Edit Match" Button
    if (e.target && e.target.classList.contains('btn-edit-match')) {
        const matchId = e.target.getAttribute('data-matchid');
        
        // Try a safe undo first
        let result = currentTournament.undoMatch(matchId, false);

        if (result.requiresConfirmation) {
            const warning = "WARNING: This match is from a previous round/stage. Editing it will DELETE all rounds and stages that happened after it, because the matchmaking will change. Are you sure?";
            if (confirm(warning)) {
                // User agreed, force destructive undo
                result = currentTournament.undoMatch(matchId, true);
            }
        }

        if (result && result.success) {
            saveTournamentLocally(currentTournament);
            // If we deleted stages, ensure we are viewing the active stage again
            window.viewingStageIndex = currentTournament.stages.length - 1; 
            updateUI();
        }
    }
    
});

document.getElementById('btn-add-player').addEventListener('stateChanged', updateUI);

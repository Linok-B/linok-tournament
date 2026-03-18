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

// --- SETTINGS EVENT LISTENERS ---

const nameInput = document.getElementById('setting-name');
const winInput = document.getElementById('setting-pts-win');
const drawInput = document.getElementById('setting-pts-draw');
const lossInput = document.getElementById('setting-pts-loss');

// Sync inputs to the engine when they type or change a number
nameInput.addEventListener('input', (e) => {
    currentTournament.settings.name = e.target.value || "Untitled Tournament";
    updateTitle();
    saveTournamentLocally(currentTournament);
});

winInput.addEventListener('change', (e) => {
    currentTournament.settings.pointsForWin = parseInt(e.target.value) || 0;
    if(currentTournament.status !== "setup") currentTournament.recalculateAllStats();
    saveTournamentLocally(currentTournament);
    updateUI();
});

drawInput.addEventListener('change', (e) => {
    currentTournament.settings.pointsForDraw = parseInt(e.target.value) || 0;
    if(currentTournament.status !== "setup") currentTournament.recalculateAllStats();
    saveTournamentLocally(currentTournament);
    updateUI();
});

lossInput.addEventListener('change', (e) => {
    currentTournament.settings.pointsForLoss = parseInt(e.target.value) || 0;
    if(currentTournament.status !== "setup") currentTournament.recalculateAllStats();
    saveTournamentLocally(currentTournament);
    updateUI();
});

// Helper function to update the big title and sync inputs on load
function updateTitle() {
    const titleEl = document.getElementById('main-tournament-title');
    if (titleEl) titleEl.innerText = currentTournament.settings.name;
    
    // Ensure inputs match the loaded data
    if (nameInput) nameInput.value = currentTournament.settings.name;
    if (winInput) winInput.value = currentTournament.settings.pointsForWin;
    if (drawInput) drawInput.value = currentTournament.settings.pointsForDraw;
    if (lossInput) lossInput.value = currentTournament.settings.pointsForLoss;
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
    const modal = document.getElementById('warning-modal');
    
    // Dynamically change the text for a Reset
    document.querySelector('#warning-modal h2').innerText = "⚠️ RESET TOURNAMENT";
    document.getElementById('warning-modal-text').innerText = "This will permanently delete the entire tournament, all players, and all match history. Are you absolutely sure?";
    document.getElementById('modal-btn-confirm').innerText = "Delete Everything";
    
    modal.style.display = 'flex';

    // Define the button actions for THIS specific scenario
    document.getElementById('modal-btn-cancel').onclick = () => {
        modal.style.display = 'none'; 
    };

    document.getElementById('modal-btn-export').onclick = () => {
        exportTournamentJSON(currentTournament); 
    };

    document.getElementById('modal-btn-confirm').onclick = () => {
        clearLocalData();
        currentTournament = new Tournament(); 
        window.viewingStageIndex = 0; // Reset tab view
        updateUI();
        modal.style.display = 'none'; 
    };
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
    updateTitle();
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

    // 4. Handle "Edit Match" Button (Custom Modal)
    if (e.target && e.target.classList.contains('btn-edit-match')) {
        const matchId = e.target.getAttribute('data-matchid');
        let result = currentTournament.undoMatch(matchId, false);

        if (result.requiresConfirmation) {
            const modal = document.getElementById('warning-modal');
            
            // Dynamically set text back to the Edit Warning
            document.querySelector('#warning-modal h2').innerText = "⚠️ DESTRUCTIVE ACTION";
            document.getElementById('warning-modal-text').innerText = "Editing this match will permanently delete all rounds and stages that happened after it.";
            document.getElementById('modal-btn-confirm').innerText = "Delete & Edit";
            
            modal.style.display = 'flex';

            // Define exactly what the buttons do inside the modal
            
            document.getElementById('modal-btn-cancel').onclick = () => {
                modal.style.display = 'none'; // Close modal, do nothing
            };

            document.getElementById('modal-btn-export').onclick = () => {
                exportTournamentJSON(currentTournament); // Downloads backup, keeps modal open!
            };

            document.getElementById('modal-btn-confirm').onclick = () => {
                // User agreed, force destructive undo
                const finalResult = currentTournament.undoMatch(matchId, true);
                if (finalResult.success) {
                    saveTournamentLocally(currentTournament);
                    window.viewingStageIndex = currentTournament.stages.length - 1; 
                    updateUI();
                }
                modal.style.display = 'none'; // Close modal
            };

        } else if (result.success) {
            // It was a safe undo (latest round), no warning needed
            saveTournamentLocally(currentTournament);
            window.viewingStageIndex = currentTournament.stages.length - 1; 
            updateUI();
        }
    }
    
});

document.getElementById('btn-add-player').addEventListener('stateChanged', updateUI);

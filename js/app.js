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

function renderBlueprintList() {
    const list = document.getElementById('blueprint-list');
    if (!list) return;
    list.innerHTML = '';
    
    const formatNames = {
        "single_elimination": "Single Elim",
        "round_robin": "Round Robin",
        "swiss": "Swiss"
    };

    currentTournament.settings.pipeline.forEach((stage, index) => {
        // Check if this stage has already been started/completed
        const isLocked = index < currentTournament.stages.length;
        
        // Format the extra options for display
        let details = [];
        if (stage.maxRounds) details.push(`${stage.maxRounds} Rnds`);
        if (stage.cutToTop) details.push(`Top ${stage.cutToTop}`);
        const detailStr = details.length > 0 ? ` <small style="color:gray;">(${details.join(', ')})</small>` : '';
        
        list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px; border-left: 3px solid ${isLocked ? '#a6e3a1' : 'var(--accent)'};">
                <span style="font-size: 13px;"><b>${index + 1}.</b> ${formatNames[stage.type]}${detailStr}</span>
                ${!isLocked 
                    ? `<button class="btn-remove-stage" data-index="${index}" style="background: transparent; color: var(--danger); border: none; cursor: pointer; font-weight: bold; padding: 0 5px;">X</button>` 
                    : '<span style="font-size:10px; color:gray;">Locked</span>'}
            </div>
        `;
    });
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
    renderBlueprintList();
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

    // 5. Force End Stage Early (W/ Options)
    if (e.target && e.target.id === 'btn-force-end-stage') {
        const activeStage = currentTournament.stages[currentTournament.stages.length - 1];
        const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
        
        // Are there actually unfinished matches?
        const isRoundUnfinished = currentRound.some(m => m.winner === null && !m.isBye);

        // Did they submit literally zero scores this round?
        const matchesSubmitted = currentRound.filter(m => m.winner !== null && !m.isBye).length;
        
        if (!isRoundUnfinished) {
            // Round is fully complete anyway, just end the stage safely!
            executeEndStage(); 
            return;
        }

        // If the round is totally empty, just delete it
        if (matchesSubmitted === 0) {
            activeStage.data.rounds.pop(); 
            executeEndStage();
            return;
        }

        // Round is partial. Show the new Modal!
        const modal = document.getElementById('end-stage-modal');
        modal.style.display = 'flex';

        // OPTION 1: Rollback
        document.getElementById('modal-btn-end-rollback').onclick = () => {
            activeStage.data.rounds.pop(); // Delete the entire partial round
            executeEndStage();
            modal.style.display = 'none';
        };

        // OPTION 2: Force Ties
        document.getElementById('modal-btn-end-tie').onclick = () => {
            if (activeStage.config.type === "single_elimination") {
                alert("You cannot force ties in an Elimination bracket. Please Rollback instead.");
                return;
            }
            
            // Loop through the round and force ties on pending matches
            currentRound.forEach(m => {
                if (m.winner === null && !m.isBye) {
                    m.score1 = 0;
                    m.score2 = 0;
                    m.winner = "tie";
                }
            });
            executeEndStage();
            modal.style.display = 'none';
        };

        // CANCEL
        document.getElementById('modal-btn-end-cancel').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Helper function to finalize the end stage action
        function executeEndStage() {
            currentTournament.recalculateAllStats(); // Update leaderboard!
            
            activeStage.status = "completed";
            activeStage.data.isComplete = true; 
            
            if (currentTournament.stages.length >= currentTournament.settings.pipeline.length) {
                currentTournament.status = "completed";
            } else {
                currentTournament.transitionToNextStage(currentTournament.players);
            }
            
            saveTournamentLocally(currentTournament);
            updateUI();
        }
    }
    
});

// --- BLUEPRINT BUILDER EVENT LISTENERS ---

// Add a new stage to the pipeline
document.getElementById('btn-add-stage').addEventListener('click', () => {
    const type = document.getElementById('blueprint-type').value;
    const rounds = parseInt(document.getElementById('blueprint-rounds').value);
    const cut = parseInt(document.getElementById('blueprint-cut').value);
    
    const newStage = { type: type };
    if (!isNaN(rounds) && rounds > 0) newStage.maxRounds = rounds;
    if (!isNaN(cut) && cut > 0) newStage.cutToTop = cut;
    
    currentTournament.settings.pipeline.push(newStage);
    
    // Clear inputs
    document.getElementById('blueprint-rounds').value = '';
    document.getElementById('blueprint-cut').value = '';
    
    saveTournamentLocally(currentTournament);
    updateUI();
});

// Remove an un-started stage from the pipeline
document.getElementById('setup-blueprint-group').addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-remove-stage')) {
        const indexToRemove = parseInt(e.target.getAttribute('data-index'));
        
        // Remove it from the array
        currentTournament.settings.pipeline.splice(indexToRemove, 1);
        
        saveTournamentLocally(currentTournament);
        updateUI();
    }
});



document.getElementById('btn-add-player').addEventListener('stateChanged', updateUI);


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


// --- SETTINGS MODAL LOGIC ---

const settingsModal = document.getElementById('settings-modal');

document.getElementById('btn-open-settings').addEventListener('click', () => {
    document.getElementById('setting-name').value = currentTournament.settings.name;
    document.getElementById('setting-pts-win').value = currentTournament.settings.pointsForWin;
    document.getElementById('setting-pts-draw').value = currentTournament.settings.pointsForDraw;
    document.getElementById('setting-pts-loss').value = currentTournament.settings.pointsForLoss;
    
    // Fallback safely in case older save files don't have these toggles yet!
    document.getElementById('setting-randomize').checked = currentTournament.settings.randomizeSeeds || false;
    document.getElementById('setting-third-place').checked = currentTournament.settings.playThirdPlaceMatch || false;
    
    settingsModal.style.display = 'flex';
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
    currentTournament.settings.name = document.getElementById('setting-name').value || "Untitled Tournament";
    currentTournament.settings.pointsForWin = parseInt(document.getElementById('setting-pts-win').value) || 0;
    currentTournament.settings.pointsForDraw = parseInt(document.getElementById('setting-pts-draw').value) || 0;
    currentTournament.settings.pointsForLoss = parseInt(document.getElementById('setting-pts-loss').value) || 0;
    currentTournament.settings.randomizeSeeds = document.getElementById('setting-randomize').checked;
    currentTournament.settings.playThirdPlaceMatch = document.getElementById('setting-third-place').checked;
    
    if (currentTournament.status !== "setup") {
        currentTournament.recalculateAllStats(); 
    }
    
    settingsModal.style.display = 'none';
    saveTournamentLocally(currentTournament);
    updateUI();
});

function updateTitle() {
    const titleEl = document.getElementById('main-tournament-title');
    if (titleEl) titleEl.innerText = currentTournament.settings.name;
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
    if (!added) {
        alert("Cannot add players after tournament has started!");
        return;
    }
    
    nameInput.value = '';
    saveTournamentLocally(currentTournament);
    
    // 1. Capture scroll before redraw
    const sidebar = document.querySelector('.controls-panel');
    const currentScroll = sidebar.scrollTop;
    
    // 2. Redraw
    updateUI();
    
    // 3. Instantly restore scroll, then smoothly scroll the NEW player into view!
    sidebar.scrollTop = currentScroll;
    
    const newCard = document.querySelector(`.player-card[data-id="${added.id}"]`);
    if (newCard) {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    
    document.querySelector('#warning-modal h2').innerText = "⚠️ RESTART TOURNAMENT";
    document.getElementById('warning-modal-text').innerText = "This will delete all match history and return to the Setup phase. All players and settings will be KEPT. Are you sure?";
    document.getElementById('modal-btn-confirm').innerText = "Restart & Keep Players";
    
    modal.style.display = 'flex';

    document.getElementById('modal-btn-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('modal-btn-export').onclick = () => { exportTournamentJSON(currentTournament); };

    document.getElementById('modal-btn-confirm').onclick = () => {
        // Don't create a new Tournament(), just reset the arrays!
        currentTournament.stages = [];
        currentTournament.status = "setup";
        
        // Reset player stats, but keep their names, ELO, and seeds!
        currentTournament.players.forEach(p => {
            p.isEliminated = false;
            p.stats = { matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0, points: 0 };
        });

        // Reset camera
        window.bracketCamera = { x: 0, y: 0, scale: 1 };
        
        window.viewingStageIndex = 0; 
        saveTournamentLocally(currentTournament);
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
    const inputs = document.querySelectorAll('#player-list-container input[type="number"]');
    const draftScores = {};
    inputs.forEach(input => { draftScores[input.id] = input.value; });

    const sidebar = document.querySelector('.controls-panel');
    const savedScrollTop = sidebar ? sidebar.scrollTop : 0;

    updateTitle(); 
    renderBlueprintList(); 
    renderBracket(currentTournament, 'player-list-container');
    
    // CRITICAL FIX: Clear the leaderboard if we are in Setup phase!
    const standingsDiv = document.getElementById('standings-container');
    if (currentTournament.status !== "setup") {
        renderStandings(currentTournament, 'standings-container');
    } else if (standingsDiv) {
        standingsDiv.innerHTML = ''; // Kill the Ghost Leaderboard!
    }

    for (const [id, value] of Object.entries(draftScores)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    if (sidebar) sidebar.scrollTop = savedScrollTop;
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

        // Reset the camera position when switching tabs
        window.bracketCamera = { x: 0, y: 0, scale: 1 };
        
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
    
    // NEW: Get the selected tiebreaker profile
    const tbProfile = document.getElementById('blueprint-tiebreakers').value;
    
    // Translate the profile string into the actual math array!
    let tbArray = ["game_differential", "head_to_head", "seed"]; // default "standard"
    if (tbProfile === "chess") tbArray = ["median_buchholz", "buchholz", "head_to_head", "seed"];
    if (tbProfile === "elo") tbArray = ["elo", "head_to_head", "seed"];

    const newStage = { type: type, tiebreakers: tbArray }; // Add it to the config!
    if (!isNaN(rounds) && rounds > 0) newStage.maxRounds = rounds;
    if (!isNaN(cut) && cut > 0) newStage.cutToTop = cut;
    
    currentTournament.settings.pipeline.push(newStage);
    
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


// hamburgur :tongue:
// Sidebar Toggle
document.getElementById('btn-hamburger').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-hidden');
});

// Eye Icon (Streamer Mode Toggle)
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-streamer-mode') {
        document.body.classList.toggle('streamer-mode');
        
        // Change icon based on state
        if (document.body.classList.contains('streamer-mode')) {
            e.target.innerText = "❌ Exit Stream Mode";
            e.target.style.background = "var(--danger)";
        } else {
            e.target.innerText = "👁️ Stream Mode";
            e.target.style.background = "rgba(0,0,0,0.5)";
        }
    }
});

// GLOBAL MODAL CLOSE (Clicking the dark background)
document.addEventListener('click', (e) => {
    // Check if what we clicked has the dark background overlay style
    // (Our modals all use background: rgba(0,0,0,0.8))
    if (e.target.style.background === 'rgba(0, 0, 0, 0.8)') {
        e.target.style.display = 'none';
    }
});

// Handle Custom Drag-and-Drop List Reordering
document.addEventListener('playerListReordered', (e) => {
    if (currentTournament.status !== "setup") return;

    const newOrderIds = e.detail.newOrderIds;
    
    // 1. Rebuild the Engine's array based on the physical DOM order
    const reorderedPlayers = newOrderIds.map(id => {
        return currentTournament.players.find(p => p.id === id);
    }).filter(p => p); 
    
    currentTournament.players = reorderedPlayers;
    
    // 2. Recalculate Seeds in the Engine!
    currentTournament.players.forEach((p, index) => {
        p.seed = index + 1;
    });
    
    // 3. IN-PLACE UI UPDATE (No flicker!)
    // Instead of calling updateUI() and destroying the list, we just loop through 
    // the existing physical cards and change the text from "1." to "2." etc.
    const container = document.getElementById('player-list-container');
    Array.from(container.children).forEach((card, index) => {
        const seedSpan = card.querySelector('.seed-number');
        if (seedSpan) {
            seedSpan.innerText = `${index + 1}.`;
        }
    });
    
    // do NOT call updateUI()
    saveTournamentLocally(currentTournament);
});

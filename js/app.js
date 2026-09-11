import { Tournament } from './engine/tournament.js';
import { renderBracket, renderStandings } from './ui/renderer.js';
import { openDPWSetupModal, validateDPWStageReadiness } from './ui/dpwSetup.js';
import { getIcon } from './ui/icons.js';
import { initStaticModals } from './ui/staticModals.js';
import { openStageSettingsModal } from './ui/stageSettings.js';
import { saveTournamentLocally, loadTournamentLocally, getAppMeta, setAppMeta } from './store/localData.js';
import { exportTournamentJSON, parseTournamentImportJSON } from './store/export.js';
import { openTournamentLibraryModal } from './ui/libraryModal.js';
import { initModalStacker } from './ui/modalStacker.js';
import { initTiebreakerModal, getPendingTiebreakers } from './ui/tiebreakerModal.js';
import { initSettingsModal, applyUITheme, updateTitle } from './ui/settingsModal.js';
import { renderBlueprintList, initBlueprintBuilder } from './ui/blueprintBuilder.js';

// Auto-inject SVGs into the HTML
document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const size = el.getAttribute('data-size') || 18;
    el.innerHTML = getIcon(iconName, size);
});

let currentTournament = new Tournament();

try {
    const savedData = await loadTournamentLocally();
    if (savedData) {
        currentTournament = Object.assign(new Tournament(), savedData);

        // Failsafe sanitization for corrupted state
        if (!Array.isArray(currentTournament.players)) currentTournament.players = [];
        if (!Array.isArray(currentTournament.stages)) currentTournament.stages = [];
        if (!currentTournament.settings) currentTournament.settings = new Tournament().settings;
    }
} catch (err) {
    console.error("Corrupted tournament state detected on load. Resetting workspace:", err);
    currentTournament = new Tournament();
    await saveTournamentLocally(currentTournament);
}


// inits
initModalStacker();
initStaticModals(() => currentTournament.settings.name);
initTiebreakerModal();
initSettingsModal(() => currentTournament, updateUI);
initBlueprintBuilder(() => currentTournament, updateUI);


updateUI();

// Add Player Event
document.getElementById('btn-add-player').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const eloInput = document.getElementById('player-elo');
    const rawNames = nameInput.value;
    if (rawNames.trim() === '') return;

    // Split by newlines, trim spaces, and filter out empty lines
    const names = rawNames.split('\n').map(n => n.trim()).filter(n => n !== '');
    
    let lastAddedPlayer = null;

    for (let name of names) {
        const added = currentTournament.addPlayer(name, eloInput.value);
        if (!added) {
            alert("Cannot add players after the tournament has started!");
            return;
        }
        lastAddedPlayer = added;
    }
    
    nameInput.value = '';
    saveTournamentLocally(currentTournament);
    
    // Capture scroll before redraw
    const sidebar = document.querySelector('.controls-panel');
    const currentScroll = sidebar.scrollTop;
    
    // Redraw
    updateUI();
    
    // Restore scroll, then smoothly scroll the very last added player into view (will it work, or will it remain broken... who knows! It might now cuz hardcoded magic number goes brr)
    sidebar.scrollTop = currentScroll;
    
    if (lastAddedPlayer) {
        setTimeout(() => {
            const newCard = document.querySelector(`.player-card[data-id="${lastAddedPlayer.id}"]`);
            if (newCard) {
                newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 50); // My 50ms hardcoded magic number and I for the win!
    }
});

// Start Tournament Event
document.getElementById('btn-start-elim').addEventListener('click', () => {
    if (currentTournament.status !== "setup") {
        alert("Tournament is already active!");
        return;
    }

    if (currentTournament.settings.pipeline.length === 0) {
        alert("Please add at least one stage to the Tournament Stages blueprint before starting!");
        return;
    }

    // DPW Failsafe Start Tournament
    const firstStage = currentTournament.settings.pipeline[0];
    if (!validateDPWStageReadiness(firstStage, currentTournament.players, 'start')) return;

    if (currentTournament.startTournament()) {
        saveTournamentLocally(currentTournament);
        updateUI();
    }
});

// Reset Button Event (With Failsafe & Emergency reset)
document.getElementById('btn-clear-data').addEventListener('click', async (e) => {
    // Emergency Reset: Shift + Click on the button to completely wipe active workspace
    if (e.shiftKey) {
        if (confirm("EMERGENCY HARD RESET:\n\nThis will completely purge the active workspace and start 100% fresh. Continue?")) {
            await saveTournamentLocally(new Tournament());
            window.location.reload();
        }
        return;
    }

    // Normal reset guard (allows reset if stages exist, even if status is confused)
    if (currentTournament.status === "setup" && currentTournament.stages.length === 0) {
        alert("The tournament hasn't started yet! You are already in the Setup phase.\n\n(Tip: Hold Shift + Click this button if you need an emergency hard reset).");
        return;
    }

    const modal = document.getElementById('warning-modal');
    document.getElementById('warning-modal-title').innerHTML = `${getIcon('warning', 28)} RESTART TOURNAMENT`;
    document.getElementById('warning-modal-text').innerText = "This will delete all match history and return to the Setup phase. All players and settings will be KEPT. Are you sure?";
    document.getElementById('modal-btn-confirm').innerText = "Restart & Keep Players";
    
    modal.style.display = 'flex';

    document.getElementById('modal-btn-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('modal-btn-export').onclick = () => { exportTournamentJSON(currentTournament); };

    document.getElementById('modal-btn-confirm').onclick = async () => {
        try {
            // 1. Reset tournament state
            currentTournament.stages = [];
            currentTournament.status = "setup";
            
            // 2. Safely filter and restore true registration order
            if (Array.isArray(currentTournament.players)) {
                currentTournament.players = currentTournament.players.filter(Boolean);
                currentTournament.players.sort((a, b) => (a.originalSeed || a.seed || 0) - (b.originalSeed || b.seed || 0));
                
                // 3. Reset player stats and un-scramble matchmaking seeds
                currentTournament.players.forEach((p, index) => {
                    p.isEliminated = false;
                    p.seed = p.originalSeed || index + 1;
                    p.stats = { matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0, points: 0 };
                });
            } else {
                currentTournament.players = [];
            }

            // 4. Reset camera and UI view index
            window.bracketCamera = { x: 0, y: 0, scale: 1 };
            window.viewingStageIndex = 0; 
            
            await saveTournamentLocally(currentTournament);
            updateUI();
        } catch (err) {
            console.error("Error during restart:", err);
            // If even restart throws, fall back to clean tournament object
            currentTournament = new Tournament();
            await saveTournamentLocally(currentTournament);
            updateUI();
        } finally {
            modal.style.display = 'none'; 
        }
    };
});

document.getElementById('btn-export-data').addEventListener('click', () => {
    exportTournamentJSON(currentTournament);
});

// Import Button (Clicks the hidden file input)
document.getElementById('btn-import-data').addEventListener('click', () => {
    // Only allow import during the setup phase to prevent accidental overwrites mid-tournament
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

    parseTournamentImportJSON(file, async (success, result) => {
        if (!success) {
            alert(result);
            return;
        }

        if (result.type === 'single') {
            currentTournament = Object.assign(new Tournament(), result.tournament);
            await saveTournamentLocally(currentTournament);
            window.viewingStageIndex = currentTournament.stages.length > 0 ? currentTournament.stages.length - 1 : 0;
            updateUI();
            alert("Tournament successfully imported!");
        } else if (result.type === 'bundle') {
            alert(`This file contains a bundle of ${result.tournaments.length} tournaments. Please open the Tournament Library to import bundles.`);
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

    applyUITheme(currentTournament);
    updateTitle(currentTournament);
    renderBlueprintList(currentTournament, updateUI);
    renderBracket(currentTournament, 'player-list-container');
    
    // Clear the leaderboard if we are in Setup phase
    const standingsDiv = document.getElementById('standings-container');
    if (currentTournament.status !== "setup") {
        renderStandings(currentTournament, 'standings-container');
    } else if (standingsDiv) {
        standingsDiv.innerHTML = ''; // Kill the Ghost Leaderboard
    }

    for (const [id, value] of Object.entries(draftScores)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    if (sidebar) sidebar.scrollTop = savedScrollTop;
}

document.getElementById('player-list-container').addEventListener('click', async (e) => {
    
    // 1. Handle "Submit Score" Button
    if (e.target && e.target.classList.contains('btn-report')) {
        const matchId = e.target.getAttribute('data-matchid');

        // STAGE TRANSITION GUARD (DPW Validation)
        const activeStage = currentTournament.stages[currentTournament.stages.length - 1];
        if (activeStage) {
            const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
            const unfinishedMatches = currentRound.filter(m => m.winner === null && !m.isBye);
            
            // If this is the last unfinished match, submitting it MIGHT end the stage.
            if (unfinishedMatches.length === 1 && unfinishedMatches[0].id === matchId) {
                
                // STAGE TRANSITION GUARD
                const nextConfig = currentTournament.settings.pipeline[currentTournament.stages.length];
                if (!validateDPWStageReadiness(nextConfig, currentTournament.players, 'report')) return;
            }
        }
        
        // Safely grab the inputs. If they don't exist in the DOM, default to '0'
        const s1Input = document.getElementById(`s1-${matchId}`);
        const s2Input = document.getElementById(`s2-${matchId}`);
        const dInput = document.getElementById(`d-${matchId}`);

        const score1 = s1Input ? s1Input.value : 0;
        const score2 = s2Input ? s2Input.value : 0;
        const draws = dInput ? dInput.value : 0;

        // Send to Engine
        const success = await currentTournament.reportMatchScore(matchId, score1, score2, draws);
        
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
            document.getElementById('warning-modal-title').innerHTML = `${getIcon('warning', 28)} DESTRUCTIVE ACTION`;
            document.getElementById('warning-modal-text').innerText = "Editing this match will permanently delete all rounds and stages that happened after it.";
            document.getElementById('modal-btn-confirm').innerText = "Delete & Edit";
            
            modal.style.display = 'flex';

            // Define exactly what the buttons do inside the modal
            
            document.getElementById('modal-btn-cancel').onclick = () => {
                modal.style.display = 'none'; // Close modal, do nothing
            };

            document.getElementById('modal-btn-export').onclick = () => {
                exportTournamentJSON(currentTournament); // Downloads backup
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
        if (!activeStage || !activeStage.data.rounds || activeStage.data.rounds.length === 0) return;

        // STAGE TRANSITION GUARD (DPW Validation)
        const nextConfig = currentTournament.settings.pipeline[currentTournament.stages.length];
        if (!validateDPWStageReadiness(nextConfig, currentTournament.players, 'force_end')) return;

        const currentRoundIndex = activeStage.data.rounds.length - 1;
        const currentRound = activeStage.data.rounds[currentRoundIndex];
        
        // Are there actually unfinished matches?
        const isRoundUnfinished = currentRound.some(m => m.winner === null && !m.isBye);
        const matchesSubmitted = currentRound.filter(m => m.winner !== null || m.isBye).length;
        
        // Helper function to finalize and cleanly advance view
        function executeEndStage() {
            currentTournament.recalculateAllStats(); 
            activeStage.status = "completed";
            activeStage.data.isComplete = true; 
            
            if (currentTournament.stages.length >= currentTournament.settings.pipeline.length) {
                currentTournament.status = "completed";
            } else {
                currentTournament.transitionToNextStage(currentTournament.players);
            }

            // Always snap the camera and viewing tab to the newly active stage
            window.viewingStageIndex = currentTournament.stages.length - 1;
            window.bracketCamera = { x: 0, y: 0, scale: 1 };

            saveTournamentLocally(currentTournament);
            updateUI();
        }

        // If the round is already 100% complete, end immediately
        if (!isRoundUnfinished) {
            executeEndStage(); 
            return;
        }

        // If not a single real match has been scored yet
        if (matchesSubmitted === 0) {
            if (activeStage.data.rounds.length <= 1) {
                alert("Cannot end stage on Round 1 with zero matches played. To cancel this tournament, click 'Restart Tournament' instead.");
                return;
            }
            activeStage.data.rounds.pop(); // Silent rollback of empty subsequent round
            executeEndStage();
            return;
        }

        // Round is partial. Show the Modal
        const modal = document.getElementById('end-stage-modal');
        modal.style.display = 'flex';

        document.getElementById('modal-btn-end-rollback').onclick = () => {
            // Cannot rollback Round 1 (no previous rounds exist to determine standings)
            if (activeStage.data.rounds.length <= 1) {
                alert("Cannot rollback Round 1 because there are no previous rounds to determine standings. Choose 'Force Ties' or click 'Restart Tournament' in the sidebar.");
                return;
            }
            modal.style.display = 'none';
            activeStage.data.rounds.pop(); 
            executeEndStage();
        };

        document.getElementById('modal-btn-end-tie').onclick = () => {
            if (activeStage.config.type === "single_elimination" || activeStage.config.type === "double_elimination") {
                alert("You cannot force ties in an Elimination bracket. Please Rollback instead.");
                return;
            }
            modal.style.display = 'none';
            currentRound.forEach(m => {
                if (m.winner === null && !m.isBye) {
                    m.score1 = 0; m.score2 = 0; m.draws = 0; m.winner = "tie";
                }
            });
            executeEndStage();
        };

        document.getElementById('modal-btn-end-cancel').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
});


// Clear All Players Event
document.getElementById('btn-clear-players').addEventListener('click', () => {
    if (currentTournament.status !== "setup") {
        alert("Cannot remove players after the tournament has started!");
        return;
    }
    if (confirm("Are you sure you want to delete ALL players?")) {
        currentTournament.players = [];
        saveTournamentLocally(currentTournament);
        updateUI();
    }
});

// Handle Custom Drag-and-Drop List Reordering
document.addEventListener('playerListReordered', (e) => {
    if (currentTournament.status !== "setup") return;

    const newOrderIds = e.detail.newOrderIds;
    
    // 1. Update the Engine
    const reorderedPlayers = newOrderIds.map(id => {
        return currentTournament.players.find(p => p.id === id);
    }).filter(p => p); 
    currentTournament.players = reorderedPlayers;
    
    currentTournament.players.forEach((p, index) => {
        p.seed = index + 1;
        p.originalSeed = index + 1;
    });
    
    // 2. Target the correct sub-list
    const listContainer = document.getElementById('players-list');
    if (listContainer) {
        Array.from(listContainer.children).forEach((card, index) => {
            const seedSpan = card.querySelector('.seed-number');
            if (seedSpan) {
                seedSpan.innerText = `${index + 1}`;
            }
        });
    }
    
    saveTournamentLocally(currentTournament);
});


// Lib Modal thing
document.getElementById('btn-open-library').addEventListener('click', () => {
    openTournamentLibraryModal(currentTournament, (loadedTournament) => {
        currentTournament = Object.assign(new Tournament(), loadedTournament);
        window.viewingStageIndex = currentTournament.stages.length > 0 ? currentTournament.stages.length - 1 : 0;
        updateUI();
    });
});


if (currentTournament.settings.preloadWasm) {
    import('./engine/matchmakers/matchmakerBridge.js').then(({ preloadAllEngines }) => {
        preloadAllEngines();
    });
}

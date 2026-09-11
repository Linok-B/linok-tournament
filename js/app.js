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

let _stageMousedown = null;
let _stageMousemove = null;
let _stageMouseup = null;

// inits
initModalStacker();
initStaticModals(() => currentTournament.settings.name);
initTiebreakerModal();
initSettingsModal(() => currentTournament, updateUI);



function renderBlueprintList() {
    const list = document.getElementById('blueprint-list');
    if (!list) return;
    list.innerHTML = '';
    
    const formatNames = {
        "single_elimination": "Single Elim",
        "round_robin": "Round Robin",
        "swiss": "Swiss", 
        "dpw_swiss": "DPW Swiss",
        "double_elimination": "Double Elim" 
    };

    currentTournament.settings.pipeline.forEach((stage, index) => {
        // Status checks
        const isStarted = index < currentTournament.stages.length;
        const isCompleted = index < currentTournament.stages.length - 1 || currentTournament.status === "completed";
        
        let details = [];
        if (stage.maxRounds) details.push(`${stage.maxRounds} Rnds`);
        if (stage.cutToTop) details.push(`Top ${stage.cutToTop}`);
        const detailStr = details.length > 0 ? ` <small style="color:gray;">(${details.join(', ')})</small>` : '';
        
        list.innerHTML += `
            <div class="blueprint-stage-card" data-index="${index}" data-locked="${isStarted}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px; border-left: 3px solid ${isStarted ? 'var(--success)' : 'var(--accent)'}; box-sizing: border-box; width: 100%;">
                
                <!-- 1. Drag Handle (Only shows if stage is UNSTARTED) -->
                ${!isStarted ? `<div class="stage-drag-handle" style="color: var(--accent); font-size: 16px; font-weight: bold; cursor: grab; padding: 5px; flex-shrink: 0; user-select:none;">⋮⋮</div>` : ''}
                
                <span style="font-size: 13px; flex-grow:1; margin-left:${isStarted ? '24px' : '0'};"><b>${index + 1}.</b> ${formatNames[stage.type]}${detailStr}</span>
                
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${stage.type === 'dpw_swiss' && !isStarted ? `<button class="btn-edit-dpw" data-index="${index}" style="background: transparent; color: var(--warning); border: none; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Edit Teams">${getIcon('gear', 14)}</button>` : ''}
                    <button class="btn-edit-stage-settings" data-index="${index}" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Stage Settings">${getIcon('gear', 14)}</button>
                    ${!isStarted ? `<button class="btn-remove-stage" data-index="${index}" style="background: transparent; color: var(--danger); border: none; cursor: pointer; font-weight: bold; padding: 0;">X</button>` : ''}
                </div>
            </div>
        `;
    });
}

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
    renderBlueprintList(); 
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
    applyStageDragAndDrop();
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

// BLUEPRINT BUILDER EVENT LISTENERS

// Add a new stage to the pipeline
document.getElementById('btn-add-stage').addEventListener('click', () => {
    const type = document.getElementById('blueprint-type').value;
    const rounds = parseInt(document.getElementById('blueprint-rounds').value);
    const cut = parseInt(document.getElementById('blueprint-cut').value);
    // (Removed tbProfile because the dropdown doesn't exist anymore)
    
    // DPW SWISS INTERCEPT
    if (type === "dpw_swiss") {
        if (currentTournament.players.length < 2) {
            alert("Add some players first before setting up DPW Swiss!");
            return;
        }
        
        // Pass the custom tiebreakers into the setup modal via the 5th parameter (existingConfig)
        openDPWSetupModal(currentTournament.players, rounds, cut, (dpwConfig, playerTSMap) => {
            currentTournament.players.forEach(p => {
                if (!p.metadata) p.metadata = {};
                p.metadata.dpwTS = playerTSMap[p.id] || 0;
            });
            currentTournament.settings.pipeline.push(dpwConfig);
            document.getElementById('blueprint-rounds').value = '';
            document.getElementById('blueprint-cut').value = '';
            saveTournamentLocally(currentTournament);
            updateUI();
        }, { tiebreakers: getPendingTiebreakers() });
        
        return;
    }

    // Standard Formats
    // Inject the active tiebreakers configured in the builder (cloned so they don't mutate later)
    const newStage = { type: type, tiebreakers: getPendingTiebreakers() };
    
    if (!isNaN(rounds) && rounds > 0) newStage.maxRounds = rounds;
    if (!isNaN(cut) && cut > 0) newStage.cutToTop = cut;
    
    currentTournament.settings.pipeline.push(newStage);
    document.getElementById('blueprint-rounds').value = '';
    document.getElementById('blueprint-cut').value = '';
    
    saveTournamentLocally(currentTournament);
    updateUI();
});

// Remove an un-started stage from the pipeline
// Unified Blueprint Button Handler (Removes and Edits Stages)
document.getElementById('setup-blueprint-group').addEventListener('click', (e) => {
    // Handle "X" (Remove)
    if (e.target && e.target.classList.contains('btn-remove-stage')) {
        const indexToRemove = parseInt(e.target.getAttribute('data-index'));
        currentTournament.settings.pipeline.splice(indexToRemove, 1);
        saveTournamentLocally(currentTournament);
        updateUI();
    }
    
    // Handle Edit DPW
    if (e.target && e.target.classList.contains('btn-edit-dpw')) {
        const index = parseInt(e.target.getAttribute('data-index'));
        const stageConfig = currentTournament.settings.pipeline[index];
        
        openDPWSetupModal(currentTournament.players, stageConfig.maxRounds, stageConfig.cutToTop, (newConfig, newPlayerTSMap) => {
            currentTournament.settings.pipeline[index] = newConfig;
            currentTournament.players.forEach(p => {
                if (!p.metadata) p.metadata = {};
                p.metadata.dpwTS = newPlayerTSMap[p.id] || 0;
            });
            saveTournamentLocally(currentTournament);
            updateUI();
        }, stageConfig);
    }

    // Handle General Stage Settings
    if (e.target && e.target.closest('.btn-edit-stage-settings')) {
        const index = parseInt(e.target.closest('.btn-edit-stage-settings').getAttribute('data-index'));
        
        openStageSettingsModal(index, currentTournament, () => {
            saveTournamentLocally(currentTournament);
            updateUI();
        });
    }
});

// GLOBAL MODAL CLOSE (Clicking the dark background) DEPRECATED cuz ASS (it stopped working flawlessly when I wanted stacked modals to not increase opacity)
// document.addEventListener('click', (e) => {
    // Check if what we clicked has the dark background overlay style
    // (Modals all use background: rgba(0,0,0,0.8))
    // if (e.target.style.background === 'rgba(0, 0, 0, 0.8)') {
        // e.target.style.display = 'none';
    // }
// });

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

// Stage Reordering Drag 'n' Drop
function applyStageDragAndDrop() {
    const container = document.getElementById('blueprint-list');
    if (!container) return;

    let draggingElement = null;
    let placeholder = null;
    let offsetY = 0;
    let lastHoverCheck = 0;

    // Clean up old listeners
    if (_stageMousedown) container.removeEventListener('mousedown', _stageMousedown);
    if (_stageMousemove) document.removeEventListener('mousemove', _stageMousemove);
    if (_stageMouseup) document.removeEventListener('mouseup', _stageMouseup);

    _stageMousedown = (e) => {
        if (!e.target.classList.contains('stage-drag-handle')) return;
        e.preventDefault();
        
        const card = e.target.closest('.blueprint-stage-card');
        if (!card || card.getAttribute('data-locked') === 'true') return;

        const rect = card.getBoundingClientRect();
        offsetY = e.clientY - rect.top;

        placeholder = card.cloneNode(true);
        placeholder.className = 'blueprint-stage-card drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        container.insertBefore(placeholder, card);

        draggingElement = card;
        draggingElement.classList.add('drag-active-element');
        draggingElement.style.width = `${rect.width}px`;
        draggingElement.style.height = `${rect.height}px`;
        draggingElement.style.top = `${e.clientY - offsetY}px`;
        draggingElement.style.left = `${rect.left}px`;

        document.body.style.cursor = 'grabbing';
    };

    _stageMousemove = (e) => {
        if (!draggingElement) return;
        draggingElement.style.top = `${e.clientY - offsetY}px`;

        if (e.timeStamp - lastHoverCheck > 16) {
            lastHoverCheck = e.timeStamp;
            const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
            const hoveredCard = elementsUnderMouse.find(el => el.classList && el.classList.contains('blueprint-stage-card') && el !== draggingElement && el !== placeholder);

            if (hoveredCard && hoveredCard.parentNode === container) {
                // failsafe cuz cannot swap with or position above locked/started stages
                if (hoveredCard.getAttribute('data-locked') === 'true') return;

                const hoverRect = hoveredCard.getBoundingClientRect();
                const hoverMiddleY = hoverRect.top + (hoverRect.height / 2);
                if (e.clientY < hoverMiddleY) container.insertBefore(placeholder, hoveredCard);
                else container.insertBefore(placeholder, hoveredCard.nextSibling);
            }
        }
    };

    _stageMouseup = () => {
        if (!draggingElement) return;
        document.body.style.cursor = 'default';

        try {
            if (placeholder && placeholder.parentNode === container) {
                container.insertBefore(draggingElement, placeholder);
                placeholder.remove();
            }

            // Reset ONLY drag positioning, do NOT destroy inline row styles
            draggingElement.classList.remove('drag-active-element');
            draggingElement.style.position = '';
            draggingElement.style.zIndex = '';
            draggingElement.style.width = '';
            draggingElement.style.height = '';
            draggingElement.style.top = '';
            draggingElement.style.left = '';
            draggingElement.style.pointerEvents = '';

            // Save new order to pipeline (only reorders unlocked stages)
            const lockedCount = currentTournament.stages.length;
            const lockedPipeline = currentTournament.settings.pipeline.slice(0, lockedCount);
            
            const unlockedDOMs = Array.from(container.querySelectorAll('.blueprint-stage-card[data-locked="false"]'));
            const unlockedIndices = unlockedDOMs.map(el => parseInt(el.getAttribute('data-index')));
            
            const reorderedUnlocked = unlockedIndices.map(oldIdx => currentTournament.settings.pipeline[oldIdx]);
            currentTournament.settings.pipeline = [...lockedPipeline, ...reorderedUnlocked];

            saveTournamentLocally(currentTournament);
            updateUI();
        } catch (err) {
            console.error("Stage reorder failed:", err);
            updateUI();
        } finally {
            draggingElement = null;
            placeholder = null;
        }
    };

    container.addEventListener('mousedown', _stageMousedown);
    document.addEventListener('mousemove', _stageMousemove);
    document.addEventListener('mouseup', _stageMouseup);
}


if (currentTournament.settings.preloadWasm) {
    import('./engine/matchmakers/matchmakerBridge.js').then(({ preloadAllEngines }) => {
        preloadAllEngines();
    });
}

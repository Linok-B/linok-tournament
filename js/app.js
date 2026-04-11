import { Tournament } from './engine/tournament.js';
import { saveTournamentLocally, loadTournamentLocally, clearLocalData } from './store/localData.js';
import { renderBracket, renderStandings } from './ui/renderer.js';
import { exportTournamentJSON, importTournamentJSON } from './store/export.js';
import { openDPWSetupModal } from './ui/dpwSetup.js';
import { getIcon } from './ui/icons.js';

// Auto-inject SVGs into the HTML
document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const size = el.getAttribute('data-size') || 18;
    el.innerHTML = getIcon(iconName, size);
});

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
    document.getElementById('setting-full-bracket').checked = currentTournament.settings.showFullBracket || false;
    document.getElementById('setting-hide-byes').checked = currentTournament.settings.hideByes || false;
    document.getElementById('setting-show-seeds').checked = currentTournament.settings.showSeeds || false;
    
    settingsModal.style.display = 'flex';

    const ui = currentTournament.settings.ui || { theme: "modern", layout: "modern", customColors: {} };
    document.getElementById('setting-ui-layout').value = ui.layout;
    document.getElementById('setting-ui-theme').value = ui.theme;
    
    if (ui.customColors) {
        document.getElementById('color-bg-dark').value = ui.customColors.bgDark || "#1e1e2e";
        document.getElementById('color-bg-panel').value = ui.customColors.bgPanel || "#2a2a3e";
        document.getElementById('color-bg-bracket').value = ui.customColors.bgBracket || "#11111b";
        document.getElementById('color-text-main').value = ui.customColors.textMain || "#ffffff";
        document.getElementById('color-text-muted').value = ui.customColors.textMuted || "#a6adc8";
        document.getElementById('color-accent').value = ui.customColors.accent || "#89b4fa";
        document.getElementById('color-success').value = ui.customColors.success || "#a6e3a1";
        document.getElementById('color-danger').value = ui.customColors.danger || "#f38ba8";
    }
    document.getElementById('setting-custom-colors').style.display = (ui.theme === "custom") ? "grid" : "none";
});

// --- TIEBREAKER BUILDER LOGIC ---
const TB_NAMES = {
    "placement": "Tournament Placement",
    "points": "Match Points", "dpw_rating": "DPW Rating", "game_differential": "Game W-L Differential",
    "head_to_head": "Head-to-Head", "buchholz": "Buchholz", "median_buchholz": "Median Buchholz",
    "elo": "Starting ELO", "seed": "Registration Seed"
};

const TB_DEFAULTS = {
    "single_elimination": ["placement", "seed"],
    "double_elimination": ["placement", "seed"],
    "round_robin": ["points", "game_differential", "head_to_head", "seed"],
    "swiss": ["points", "buchholz", "game_differential", "head_to_head", "seed"],
    "dpw_swiss": ["dpw_rating", "head_to_head", "buchholz", "seed"]
};

let pendingTiebreakers = [...TB_DEFAULTS["single_elimination"]]; // Init state

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
    currentTournament.settings.showFullBracket = document.getElementById('setting-full-bracket').checked;
    currentTournament.settings.hideByes = document.getElementById('setting-hide-byes').checked;
    currentTournament.settings.showSeeds = document.getElementById('setting-show-seeds').checked;
    
    if (currentTournament.status !== "setup") {
        currentTournament.recalculateAllStats(); 
    }

    // Ensure UI object exists
    if (!currentTournament.settings.ui) currentTournament.settings.ui = {};
    
    currentTournament.settings.ui.layout = document.getElementById('setting-ui-layout').value;
    currentTournament.settings.ui.theme = document.getElementById('setting-ui-theme').value;
    
    currentTournament.settings.ui.customColors = {
        bgDark: document.getElementById('color-bg-dark').value,
        bgPanel: document.getElementById('color-bg-panel').value,
        bgBracket: document.getElementById('color-bg-bracket').value,
        textMain: document.getElementById('color-text-main').value,
        textMuted: document.getElementById('color-text-muted').value,
        accent: document.getElementById('color-accent').value,
        success: document.getElementById('color-success').value,
        danger: document.getElementById('color-danger').value
    };
    
    
    saveTournamentLocally(currentTournament);
    updateUI();
    settingsModal.style.display = 'none';
});

function updateTitle() {
    const titleEl = document.getElementById('main-tournament-title');
    if (titleEl) titleEl.innerText = currentTournament.settings.name;
}

// Applies the CSS Classes and Custom Colors to the DOM
function applyUITheme() {
    const ui = currentTournament.settings.ui || { theme: "modern", layout: "modern" };
    
    // 1. Set Layout Class
    document.body.classList.remove('layout-classic');
    if (ui.layout === "classic") document.body.classList.add('layout-classic');

    // 2. Set Theme Class
    document.body.classList.remove('theme-arcade', 'theme-custom');
    if (ui.theme === "arcade") document.body.classList.add('theme-arcade');
    
    // 3. Handle Custom Colors via CSS Variables
    const root = document.documentElement;
    if (ui.theme === "custom" && ui.customColors) {
        root.style.setProperty('--bg-dark', ui.customColors.bgDark);
        root.style.setProperty('--bg-panel', ui.customColors.bgPanel);
        root.style.setProperty('--bg-bracket', ui.customColors.bgBracket);
        root.style.setProperty('--accent', ui.customColors.accent);
        root.style.setProperty('--success', ui.customColors.success);
        root.style.setProperty('--danger', ui.customColors.danger);
        root.style.setProperty('--text-main', ui.customColors.textMain || '#ffffff');
        root.style.setProperty('--text-muted', ui.customColors.textMuted || '#a6adc8');
    } else {
        // Clear manual overrides so CSS classes take over again
        root.style.removeProperty('--bg-dark');
        root.style.removeProperty('--bg-panel');
        root.style.removeProperty('--bg-bracket');
        root.style.removeProperty('--accent');
        root.style.removeProperty('--success');
        root.style.removeProperty('--danger');
        root.style.removeProperty('--text-main');
    }
}

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
        const isLocked = index < currentTournament.stages.length;
        
        let details = [];
        if (stage.maxRounds) details.push(`${stage.maxRounds} Rnds`);
        if (stage.cutToTop) details.push(`Top ${stage.cutToTop}`);
        const detailStr = details.length > 0 ? ` <small style="color:var(--text-muted);">(${details.join(', ')})</small>` : '';
        
        list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px; border-left: 3px solid ${isLocked ? 'var(--success)' : 'var(--accent)'};">
                <span style="font-size: 13px;"><b>${index + 1}.</b> ${formatNames[stage.type]}${detailStr}</span>
                <div>
                    ${stage.type === 'dpw_swiss' && !isLocked ? `<button class="btn-edit-dpw" data-index="${index}" style="background: transparent; color: var(--warning); border: none; cursor: pointer; font-weight: bold; padding: 0 5px;" title="Edit Teams">⚙️</button>` : ''}
                    ${!isLocked 
                        ? `<button class="btn-remove-stage" data-index="${index}" style="background: transparent; color: var(--danger); border: none; cursor: pointer; font-weight: bold; padding: 0 5px;">X</button>` 
                        : '<span style="font-size:10px; color:var(--text-muted);">Locked</span>'}
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

    if (currentTournament.settings.pipeline.length === 0) {
        alert("Please add at least one stage to the Tournament Stages blueprint before starting!");
        return;
    }

    // DPW Failsafe
    const hasDPW = currentTournament.settings.pipeline.some(s => s.type === "dpw_swiss");
    if (hasDPW) {
        const missingTS = currentTournament.players.find(p => p.metadata?.dpwTS === undefined);
        if (missingTS) {
            alert(`Wait! Player '${missingTS.name}' does not have a team weight (TS) assigned for DPW Swiss. Please click the ⚙️ icon in the Blueprint to assign their team.`);
            return;
        }
    }

    if (currentTournament.startTournament()) {
        saveTournamentLocally(currentTournament);
        updateUI();
    }
});

// Reset Button Event
document.getElementById('btn-clear-data').addEventListener('click', () => {
    const modal = document.getElementById('warning-modal');
    
    document.getElementById('warning-modal-title').innerHTML = `${getIcon('warning', 28)} RESTART TOURNAMENT`;
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

    applyUITheme();
    updateTitle();
    renderBlueprintList(); 
    renderBracket(currentTournament, 'player-list-container');
    
    // Clear the leaderboard if we are in Setup phase
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
        
        // Safely grab the inputs. If they don't exist in the DOM, default to '0'
        const s1Input = document.getElementById(`s1-${matchId}`);
        const s2Input = document.getElementById(`s2-${matchId}`);
        const dInput = document.getElementById(`d-${matchId}`);

        const score1 = s1Input ? s1Input.value : 0;
        const score2 = s2Input ? s2Input.value : 0;
        const draws = dInput ? dInput.value : 0;

        // Send to Engine
        const success = currentTournament.reportMatchScore(matchId, score1, score2, draws);
        
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
        const matchesSubmitted = currentRound.filter(m => m.winner !== null || m.isBye).length;
        
        // Helper function to finalize
        function executeEndStage() {
            currentTournament.recalculateAllStats(); 
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

        if (!isRoundUnfinished) {
            executeEndStage(); 
            return;
        }

        if (matchesSubmitted === 0) {
            activeStage.data.rounds.pop(); // Silent Rollback
            executeEndStage();
            return;
        }

        // Round is partial. Show the Modal!
        const modal = document.getElementById('end-stage-modal');
        modal.style.display = 'flex';

        document.getElementById('modal-btn-end-rollback').onclick = () => {
            activeStage.data.rounds.pop(); 
            executeEndStage();
            modal.style.display = 'none';
        };

        document.getElementById('modal-btn-end-tie').onclick = () => {
            if (activeStage.config.type === "single_elimination" || activeStage.config.type === "double_elimination") {
                alert("You cannot force ties in an Elimination bracket. Please Rollback instead.");
                return;
            }
            currentRound.forEach(m => {
                if (m.winner === null && !m.isBye) {
                    m.score1 = 0; m.score2 = 0; m.draws = 0; m.winner = "tie";
                }
            });
            executeEndStage();
            modal.style.display = 'none';
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

// --- BLUEPRINT BUILDER EVENT LISTENERS ---

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
        
        // Pass the custom tiebreakers into the setup modal via the 5th parameter (existingConfig)!
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
        }, { tiebreakers: [...pendingTiebreakers] }); 
        
        return; // Halt normal execution
    }

    // --- Standard Formats ---
    // Inject the active tiebreakers configured in the builder (cloned so they don't mutate later)
    const newStage = { type: type, tiebreakers: [...pendingTiebreakers] };
    
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
});

// BLUEPRINTS
document.getElementById('blueprint-type').addEventListener('change', (e) => {
    const format = e.target.value;
    pendingTiebreakers = [...(TB_DEFAULTS[format] || ["points"])];
    // Update button text to notify user
    document.getElementById('btn-open-tb-builder').innerHTML = `<span data-icon="scale" data-size="16"></span> Tiebreakers: ${pendingTiebreakers.length} Rules`;
    // Re-run the injector for this specific element so the icon renders!
    const span = document.getElementById('btn-open-tb-builder').querySelector('span');
    span.innerHTML = getIcon('scale', 16);
});

const tbModal = document.getElementById('tiebreaker-modal');

function renderTBList() {
    const list = document.getElementById('tb-active-list');
    list.innerHTML = '';
    const isDPW = document.getElementById('blueprint-type').value === "dpw_swiss";

    pendingTiebreakers.forEach((rule, index) => {
        const isLocked = isDPW && rule === "dpw_rating"; // DPW Rating is mandatory for DPW Swiss!

        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); padding:5px 10px; border:1px solid var(--border-main); border-radius:4px;">
                <span style="font-size:13px; color:${isLocked ? 'var(--warning)' : 'var(--text-main)'}"><b>${index + 1}.</b> ${TB_NAMES[rule] || rule} ${isLocked ? '(Locked)' : ''}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-tb-up" data-index="${index}" ${index === 0 || isLocked || (index===1 && pendingTiebreakers[0]==="dpw_rating" && isDPW) ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↑</button>
                    <button class="btn-tb-down" data-index="${index}" ${index === pendingTiebreakers.length - 1 || isLocked ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↓</button>
                    <button class="btn-tb-remove" data-index="${index}" ${isLocked ? 'disabled style="opacity:0.3; cursor:not-allowed; background:var(--border-main); color:gray;"' : 'style="background:var(--danger); color:var(--text-on-accent); border:none; border-radius:3px; padding:2px 8px; cursor:pointer; font-weight:bold;"'}>X</button>
                </div>
            </div>
        `;
    });
}

document.getElementById('btn-open-tb-builder').addEventListener('click', () => {
    renderTBList();
    tbModal.style.display = 'flex';
});

document.getElementById('btn-close-tb-builder').addEventListener('click', () => tbModal.style.display = 'none');
document.getElementById('btn-save-tb').addEventListener('click', () => {
    document.getElementById('btn-open-tb-builder').innerHTML = `<span data-icon="scale" data-size="16"></span> Tiebreakers: ${pendingTiebreakers.length} Rules`;
    const span = document.getElementById('btn-open-tb-builder').querySelector('span');
    span.innerHTML = getIcon('scale', 16);
    tbModal.style.display = 'none';
});

// Adding a rule
document.getElementById('btn-tb-add').addEventListener('click', () => {
    const rule = document.getElementById('tb-add-select').value;
    if (pendingTiebreakers.includes(rule)) {
        alert("Rule already active!");
        return;
    }
    pendingTiebreakers.push(rule);
    renderTBList();
});

// Moving / Removing rules
document.getElementById('tb-active-list').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const index = parseInt(e.target.getAttribute('data-index'));
    
    if (e.target.classList.contains('btn-tb-remove')) {
        pendingTiebreakers.splice(index, 1);
    } else if (e.target.classList.contains('btn-tb-up')) {
        [pendingTiebreakers[index - 1], pendingTiebreakers[index]] = [pendingTiebreakers[index], pendingTiebreakers[index - 1]];
    } else if (e.target.classList.contains('btn-tb-down')) {
        [pendingTiebreakers[index + 1], pendingTiebreakers[index]] = [pendingTiebreakers[index], pendingTiebreakers[index + 1]];
    }
    renderTBList();
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
            e.target.innerHTML = getIcon('openEye', 20);
        } else {
            e.target.innerHTML = getIcon('closedEye', 20);
        }
        // Ensure background always matches the panel
        e.target.style.background = "var(--bg-panel)";
        e.target.style.color = "var(--text-main)";
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
    
    // 1. Update the Engine
    const reorderedPlayers = newOrderIds.map(id => {
        return currentTournament.players.find(p => p.id === id);
    }).filter(p => p); 
    currentTournament.players = reorderedPlayers;
    
    currentTournament.players.forEach((p, index) => {
        p.seed = index + 1;
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

document.getElementById('setting-ui-theme').addEventListener('change', (e) => {
    document.getElementById('setting-custom-colors').style.display = (e.target.value === "custom") ? "grid" : "none";
});

document.getElementById('btn-reset-colors').addEventListener('click', () => {
    document.getElementById('color-bg-dark').value = "#1e1e2e";
    document.getElementById('color-bg-panel').value = "#2a2a3e";
    document.getElementById('color-bg-bracket').value = "#11111b";
    document.getElementById('color-text-main').value = "#ffffff";
    document.getElementById('color-text-muted').value = "#a6adc8";
    document.getElementById('color-accent').value = "#89b4fa";
    document.getElementById('color-success').value = "#a6e3a1";
    document.getElementById('color-danger').value = "#f38ba8";
});

import { Tournament } from './engine/tournament.js';
import { renderBracket, renderStandings } from './ui/renderer.js';
import { validateDPWStageReadiness } from './ui/dpwSetup.js';
import { getIcon } from './ui/icons.js';
import { initStaticModals } from './ui/staticModals.js';
import { saveTournamentLocally, loadTournamentLocally } from './store/localData.js';
import { exportTournamentJSON, parseTournamentImportJSON } from './store/export.js';
import { openTournamentLibraryModal } from './ui/libraryModal.js';
import { initModalStacker } from './ui/modalStacker.js';
import { initTiebreakerModal } from './ui/tiebreakerModal.js';
import { initSettingsModal, applyUITheme, updateTitle } from './ui/settingsModal.js';
import { renderBlueprintList, initBlueprintBuilder } from './ui/blueprintBuilder.js';
import { initMatchController } from './ui/matchController.js';

// Auto-inject SVGs into the HTML
document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const size = el.getAttribute('data-size') || 18;
    el.innerHTML = getIcon(iconName, size);
});

// Startup & safe state init
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
initMatchController(() => currentTournament, updateUI);

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
    
    // Clear the leaderboard if in Setup phase
    const standingsDiv = document.getElementById('standings-container');
    if (currentTournament.status !== "setup") {
        renderStandings(currentTournament, 'standings-container');
    } else if (standingsDiv) {
        standingsDiv.innerHTML = ''; // Kill the ghost Leaderboard
    }

    for (const [id, value] of Object.entries(draftScores)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    if (sidebar) sidebar.scrollTop = savedScrollTop;
}

updateUI();

// Player Management Event Handlers
document.getElementById('btn-add-player').addEventListener('click', async () => {
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
    await saveTournamentLocally(currentTournament);
    
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

document.getElementById('btn-clear-players').addEventListener('click', async () => {
    if (currentTournament.status !== "setup") {
        alert("Cannot remove players after the tournament has started!");
        return;
    }
    if (confirm("Are you sure you want to delete ALL players?")) {
        currentTournament.players = [];
        await saveTournamentLocally(currentTournament);
        updateUI();
    }
});

// Tournament Lifecycle Controls
document.getElementById('btn-start-elim').addEventListener('click', async () => {
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
        await saveTournamentLocally(currentTournament);
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

// Data Management
document.getElementById('btn-export-data').addEventListener('click', () => {
    exportTournamentJSON(currentTournament);
});

document.getElementById('btn-import-data').addEventListener('click', () => {
    if (currentTournament.status !== "setup") {
        if (!confirm("Tournament is currently active! Importing will overwrite ALL current progress. Continue?")) {
            return;
        }
    }
    document.getElementById('file-import').click();
});

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
        
        e.target.value = ''; 
    });
});

document.getElementById('btn-open-library').addEventListener('click', () => {
    openTournamentLibraryModal(currentTournament, async (loadedTournament) => {
        currentTournament = Object.assign(new Tournament(), loadedTournament);
        window.viewingStageIndex = currentTournament.stages.length > 0 ? currentTournament.stages.length - 1 : 0;
        await saveTournamentLocally(currentTournament);
        updateUI();
    });
});

// 6. Background Engine Preloading
if (currentTournament.settings.preloadWasm) {
    import('./engine/matchmakers/matchmakerBridge.js').then(({ preloadAllEngines }) => {
        preloadAllEngines();
    });
}

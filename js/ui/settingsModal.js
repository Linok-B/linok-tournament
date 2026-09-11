import { saveTournamentLocally, getAppMeta, setAppMeta } from '../store/localData.js';

export function updateTitle(tournament) {
    const titleEl = document.getElementById('main-tournament-title');
    if (titleEl) titleEl.innerText = tournament.settings.name;
}

// Applies the CSS Classes and Custom Colors to the DOM
export function applyUITheme(tournament) {
    const ui = tournament.settings.ui || { theme: "modern", layout: "modern" };
    
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
        root.style.removeProperty('--text-muted');
    }
}

export function initSettingsModal(getTournament, onSaveCallback) {
    const settingsModal = document.getElementById('settings-modal');

    // Open Settings Modal
    document.getElementById('btn-open-settings').addEventListener('click', async () => {
        const currentTournament = getTournament();

        document.getElementById('setting-name').value = currentTournament.settings.name;
        document.getElementById('setting-pts-win').value = currentTournament.settings.pointsForWin;
        document.getElementById('setting-pts-draw').value = currentTournament.settings.pointsForDraw;
        document.getElementById('setting-pts-loss').value = currentTournament.settings.pointsForLoss;
        
        document.getElementById('setting-game-pts-win').value = currentTournament.settings.pointsForGameWin || 3;
        document.getElementById('setting-game-pts-draw').value = currentTournament.settings.pointsForGameDraw || 1;
        document.getElementById('setting-game-pts-loss').value = currentTournament.settings.pointsForGameLoss || 0;
        document.getElementById('setting-record-format').value = currentTournament.settings.recordFormat || "wld";
        
        // Fallback safely in case older save files don't have these toggles yet
        document.getElementById('setting-randomize').checked = currentTournament.settings.randomizeSeeds || false;
        document.getElementById('setting-third-place').checked = currentTournament.settings.playThirdPlaceMatch || false;
        document.getElementById('setting-full-bracket').checked = currentTournament.settings.showFullBracket || false;
        document.getElementById('setting-hide-byes').checked = currentTournament.settings.hideByes || false;
        document.getElementById('setting-show-seeds').checked = currentTournament.settings.showSeeds || false;
        document.getElementById('setting-preload-wasm').checked = currentTournament.settings.preloadWasm || false;
        const autoSaveLib = await getAppMeta('autoSaveToLibrary');
        document.getElementById('setting-autosave-library').checked = autoSaveLib === true;
        
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

    // Close Settings Modal
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    // Theme selector change
    document.getElementById('setting-ui-theme').addEventListener('change', (e) => {
        document.getElementById('setting-custom-colors').style.display = (e.target.value === "custom") ? "grid" : "none";
    });

    // SMART RESET COLORS BUTTON
    document.getElementById('btn-reset-colors').addEventListener('click', () => {
        const currentTournament = getTournament();

        // 1. Check their last saved base theme (fallback to modern if null)
        let baseTheme = "modern";
        if (currentTournament.settings.ui && currentTournament.settings.ui.theme) {
            baseTheme = currentTournament.settings.ui.theme;
        }
        
        // If they were already in 'custom', we check what their layout preference is 
        // to guess their preferred base palette (Modern vs Arcade)
        if (baseTheme === "custom") {
            const layout = currentTournament.settings.ui?.layout || "modern";
            baseTheme = layout === "classic" ? "arcade" : "modern";
        }

        // 2. Load the exact Hex colors for the chosen base theme
        if (baseTheme === "arcade") {
            // Arcade Base Palette
            document.getElementById('color-bg-dark').value = "#121212";
            document.getElementById('color-bg-panel').value = "#1f1f1f";
            document.getElementById('color-bg-bracket').value = "#080808";
            document.getElementById('color-text-main').value = "#e0e0e0";
            document.getElementById('color-text-muted').value = "#808080";
            document.getElementById('color-accent').value = "#c238b3";
            document.getElementById('color-success').value = "#c238b3";
            document.getElementById('color-danger').value = "#d95a26";
        } else {
            // Catppuccin Modern Base Palette
            document.getElementById('color-bg-dark').value = "#1e1e2e";
            document.getElementById('color-bg-panel').value = "#2a2a3e";
            document.getElementById('color-bg-bracket').value = "#11111b";
            document.getElementById('color-text-main').value = "#ffffff";
            document.getElementById('color-text-muted').value = "#a6adc8";
            document.getElementById('color-accent').value = "#89b4fa";
            document.getElementById('color-success').value = "#a6e3a1";
            document.getElementById('color-danger').value = "#f38ba8";
        }
    });

    // Save Settings
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const currentTournament = getTournament();

        currentTournament.settings.name = document.getElementById('setting-name').value.trim();
        currentTournament.settings.pointsForWin = parseInt(document.getElementById('setting-pts-win').value) || 0;
        currentTournament.settings.pointsForDraw = parseInt(document.getElementById('setting-pts-draw').value) || 0;
        currentTournament.settings.pointsForLoss = parseInt(document.getElementById('setting-pts-loss').value) || 0;

        currentTournament.settings.pointsForGameWin = parseInt(document.getElementById('setting-game-pts-win').value) || 0;
        currentTournament.settings.pointsForGameDraw = parseInt(document.getElementById('setting-game-pts-draw').value) || 0;
        currentTournament.settings.pointsForGameLoss = parseInt(document.getElementById('setting-game-pts-loss').value) || 0;
        currentTournament.settings.recordFormat = document.getElementById('setting-record-format').value || "wld";
        
        currentTournament.settings.randomizeSeeds = document.getElementById('setting-randomize').checked;
        currentTournament.settings.playThirdPlaceMatch = document.getElementById('setting-third-place').checked;
        currentTournament.settings.showFullBracket = document.getElementById('setting-full-bracket').checked;
        currentTournament.settings.hideByes = document.getElementById('setting-hide-byes').checked;
        currentTournament.settings.showSeeds = document.getElementById('setting-show-seeds').checked;
        currentTournament.settings.preloadWasm = document.getElementById('setting-preload-wasm').checked;
        await setAppMeta('autoSaveToLibrary', document.getElementById('setting-autosave-library').checked);
        
        if (currentTournament.settings.preloadWasm) {
            import('../engine/matchmakers/matchmakerBridge.js').then(({ preloadAllEngines }) => {
                preloadAllEngines();
            });
        }
        
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
        
        await saveTournamentLocally(currentTournament);
        settingsModal.style.display = 'none';

        if (typeof onSaveCallback === 'function') {
            onSaveCallback();
        }
    });
}

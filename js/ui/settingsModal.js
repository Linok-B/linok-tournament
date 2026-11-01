import { getIcon } from './icons.js';
import { saveTournamentLocally, getAppMeta, setAppMeta } from '../store/localData.js';

function injectSettingsModalHTML() {
    if (document.getElementById('settings-modal')) return;

    const html = `
    <!-- TOURNAMENT SETTINGS MODAL -->
    <div id="settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center;">
        <div style="background: var(--bg-panel); padding: 30px; border-radius: 8px; width: 400px; border: 2px solid var(--accent); max-height: 90vh; overflow-y: auto; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-main); padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--accent); display:flex; align-items:center; gap:8px;">${getIcon('gear', 24)} Global Settings</h2>
                <button id="btn-close-settings" style="background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; font-weight: bold;">X</button>
            </div>
            
            <!-- Global Info -->
            <label style="font-size: 12px; color: var(--text-muted);">Tournament Name</label>
            <input type="text" id="setting-name" placeholder="Untitled Tournament" style="width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 15px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
            
            <!-- Match Points -->
            <h4 style="margin: 0 0 5px 0; color: var(--text-main);">Match Points</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Win</label>
                    <input type="number" id="setting-pts-win" value="3" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Draw</label>
                    <input type="number" id="setting-pts-draw" value="1" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Loss</label>
                    <input type="number" id="setting-pts-loss" value="0" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
            </div>

            <!-- Game Points -->
            <h4 style="margin: 15px 0 5px 0; color: var(--text-main);">Game Points</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Win</label>
                    <input type="number" id="setting-game-pts-win" value="3" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Draw</label>
                    <input type="number" id="setting-game-pts-draw" value="1" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Loss</label>
                    <input type="number" id="setting-game-pts-loss" value="0" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                </div>
            </div>

            <!-- Record Format -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Record Format</label>
                    <select id="setting-record-format" style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                        <option value="wld">W-L-D (Standard)</option>
                        <option value="wdl">W-D-L (TCG)</option>
                    </select>
                </div>
            </div>

            <!-- Appearance Settings -->
            <h4 style="margin: 0 0 10px 0; color: var(--text-main);">Appearance</h4>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Layout</label>
                    <select id="setting-ui-layout" style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                        <option value="modern">Modern (Card UI)</option>
                        <option value="classic">Classic (Flat UI)</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 11px; color: var(--text-muted);">Color Theme</label>
                    <select id="setting-ui-theme" style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                        <option value="modern">Catppuccin (Blue)</option>
                        <option value="arcade">Arcade (Dark/Magenta)</option>
                        <option value="custom">Custom Colors...</option>
                    </select>
                </div>
            </div>

            <!-- Custom Color Pickers -->
            <div id="setting-custom-colors" style="display: none; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Base Dark</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-bg-dark"></div>
                </div>
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Panels</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-bg-panel"></div>
                </div>
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Bracket BG</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-bg-bracket"></div>
                </div>
                
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Main Text</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-text-main"></div>
                </div>
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Muted Text</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-text-muted"></div>
                </div>
                
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Accent</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-accent"></div>
                </div>
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Win/Check</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-success"></div>
                </div>
                <div>
                    <label style="font-size: 10px; color: var(--text-muted);">Loss/Drop</label>
                    <div class="color-picker-wrapper"><input type="color" id="color-danger"></div>
                </div>
                <!-- Reset Button -->
                <div style="display:flex; flex-direction:column; justify-content:flex-end;">
                    <button id="btn-reset-colors" style="width:100%; height:30px; box-sizing:border-box; background:transparent; color:var(--text-muted); border:1px solid var(--border-main); border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold; transition:0.2s; display:flex; justify-content:center; align-items:center; padding:0;">↺ Reset</button>
                </div>
            </div>

            <!-- Toggles -->
            <h4 style="margin: 0 0 10px 0; color: var(--text-main);">Tournament Rules</h4>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-randomize">
                    <span>Randomize Seeds on Start</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-third-place">
                    <span>Generate 3rd Place Match (Elimination)</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-full-bracket">
                    <span>Show Full Bracket Preview</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-hide-byes">
                    <span>Hide 'Bye' Matches Visually</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-show-seeds">
                    <span>Show Player Seeds in Bracket</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-preload-wasm">
                    <span>Preload WebAssembly Engines</span>
                </label>
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="setting-autosave-library">
                    <span>Auto-Save Active Tournament to Library</span>
                </label>
            </div>
            
            <button id="btn-save-settings" style="width: 100%; background: var(--accent); color: var(--bg-dark); font-weight: bold; padding: 10px; border-radius: 4px; border: none; cursor: pointer;">Save Settings</button>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}


// Calculates perceived brightness (0 to 255) of a hex color
function getHexBrightness(hex) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#') return 0;
    const clean = hex.slice(1);
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000;
}

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

        // Dynamic light/dark detection based on Base Dark color brightness
        const brightness = getHexBrightness(ui.customColors.bgDark);
        root.style.setProperty('color-scheme', brightness >= 128 ? 'light' : 'dark');
    } else {
        // Catppuccin and Arcade are dark themes
        root.style.setProperty('color-scheme', 'dark');

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
    injectSettingsModalHTML();
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

    // Close on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            settingsModal.style.display = 'none';
        }
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

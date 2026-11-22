import { getIcon } from './icons.js';
import { openSwissConfigModal } from './swissConfigModal.js';
import { openStandingsColumnsModal } from './standingsColumns.js';
import { saveTournamentLocally } from '../store/localData.js';

function getStageTotalRounds(config, stage, tournament, maxRoundsOverride, cutOverride) {
    if (stage && stage.data.isComplete) {
        return Math.max(1, stage.data.rounds.length);
    }

    let n = tournament.players.length;
    const effectiveCut = cutOverride !== undefined ? cutOverride : config.cutToTop;
    if (!stage && effectiveCut > 0 && n > 0) {
        n = Math.min(n, effectiveCut);
    }
    n = Math.max(2, n);

    const type = config.type;
    let naturalTotal = 1;
    if (type === "single_elimination") {
        const bSize = (stage && stage.data.bracketSize) ? stage.data.bracketSize : Math.pow(2, Math.ceil(Math.log2(n)));
        naturalTotal = Math.max(1, Math.log2(bSize));
    } else if (type === "double_elimination") {
        const bSize = (stage && stage.data.bracketSize) ? stage.data.bracketSize : Math.pow(2, Math.ceil(Math.log2(n)));
        naturalTotal = Math.max(3, (2 * Math.log2(bSize)) + 1);
    } else if (type === "round_robin") {
        naturalTotal = (n % 2 === 0) ? (n - 1) : n;
    } else {
        naturalTotal = Math.max(1, Math.ceil(Math.log2(n)));
    }

    if (maxRoundsOverride && maxRoundsOverride > 0) {
        if (type === "single_elimination" || type === "double_elimination") {
            return Math.max(1, Math.min(naturalTotal, maxRoundsOverride));
        }
        return maxRoundsOverride;
    }
    return naturalTotal;
}

function injectStageSettingsModalHTML() {
    if (document.getElementById('stage-settings-modal')) return;

    const html = `
    <!-- STAGE SETTINGS MODAL -->
    <div id="stage-settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.81); z-index: 1000; justify-content: center; align-items: center;">
        <div style="background: var(--bg-panel); padding: 30px; border-radius: 8px; width: 400px; border: 2px solid var(--accent); max-height: 90vh; overflow-y: auto; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-main); padding-bottom: 10px; margin-bottom: 20px;">
                <h2 id="stage-settings-title" style="margin: 0; color: var(--accent); display:flex; align-items:center; gap:8px;">${getIcon('gear', 24)} Stage Settings</h2>
                <button id="btn-close-stage-settings" style="background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; font-weight: bold;">X</button>
            </div>
            
            <div id="stage-settings-fields" style="display: flex; flex-direction: column; gap: 15px;">
            
            </div>
            
            <button id="btn-save-stage-settings" style="width: 100%; background: var(--accent); color: var(--bg-dark); font-weight: bold; padding: 10px; border-radius: 4px; border: none; cursor: pointer; margin-top: 20px;">Save Settings</button>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}


export function openStageSettingsModal(stageIndex, tournament, onComplete) {
    injectStageSettingsModalHTML();
    const modal = document.getElementById('stage-settings-modal');
    const fieldsContainer = document.getElementById('stage-settings-fields');
    
    // Check if the stage has already started / completed
    const isStarted = stageIndex < tournament.stages.length;
    const isCompleted = stageIndex < tournament.stages.length - 1 || tournament.status === "completed";
    const stage = isStarted ? tournament.stages[stageIndex] : null;
    const config = isStarted ? stage.config : tournament.settings.pipeline[stageIndex];

    const isRoundsLocked = (isStarted && config.type === "dpw_swiss") || isCompleted; // cannot edit rounds in dpw due to dampening factor being based on nº of rounds
    
    // Rounds Played
    const roundsPlayed = isStarted ? stage.data.rounds.length : 1;
    const defaultRounds = Math.ceil(Math.log2(tournament.players.length));

    // trans state
    // Make a tmp copy of the tiebreakers. Do not mutate the config
    let tempTiebreakers = [...(config.tiebreakers || [])];

    document.getElementById('stage-settings-title').innerHTML = `${getIcon('gear', 24)} Stage ${stageIndex + 1} Settings`;

    let fromStart = config.rangeFromStart !== false;
    let toEnd = config.rangeToEnd !== false;
    let toDirty = !toEnd && (config.rangeEndCustom === true || config.rangeEnd !== undefined);
    let currentTotalRounds = getStageTotalRounds(config, stage, tournament, config.maxRounds, config.cutToTop);
    let initStart = fromStart ? 1 : Math.max(1, Math.min(currentTotalRounds, config.rangeStart || 1));
    let initEnd = toEnd ? currentTotalRounds : Math.max(initStart, Math.min(currentTotalRounds, config.rangeEnd || currentTotalRounds));
    
    /// 1. Generate Fields
    let html = `
        <!-- Row 1: Rounds and Top Cut (Side-by-Side) -->
        <div style="display: flex; gap: 10px; width: 100%;">
            <div style="flex: 1; min-width: 0;">
                <label style="font-size:11px; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${isRoundsLocked ? 'Max Rounds (Locked)' : `Max Rounds ${isStarted ? `(Min: ${roundsPlayed})` : '(Opt)'}`}
                </label>
                <input type="number" id="edit-stage-rounds" min="${roundsPlayed}" value="${config.maxRounds || ''}" placeholder="All" ${isRoundsLocked ? 'disabled' : ''} style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isRoundsLocked ? 'opacity:0.5; cursor:not-allowed;' : ''}">
            </div>
            <div style="flex: 1; min-width: 0;">
                <label style="font-size:11px; color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Top Cut ${isStarted ? '(Locked)' : '(Opt)'}</label>
                <input type="number" id="edit-stage-cut" ${isStarted ? 'disabled' : ''} value="${config.cutToTop || ''}" placeholder="All" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isStarted ? 'opacity:0.5; cursor:not-allowed;' : ''}">
            </div>
        </div>

        <!-- Row 1.5: Bracket Display Range -->
        <div style="border-top: 1px solid var(--border-main); padding-top: 12px;">
            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px;">Bracket Display Range</label>
            <div style="display: flex; gap: 10px; width: 100%; align-items: flex-start;">
                <div style="flex: 1; min-width: 0;">
                    <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">From</label>
                    <input type="number" id="edit-range-start" min="1" max="${currentTotalRounds}" value="${initStart}" ${fromStart ? 'disabled' : ''} style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${fromStart ? 'opacity:0.5; cursor:not-allowed;' : ''}">
                    <label class="custom-checkbox-label" style="margin-top: 6px; font-size: 11px;">
                        <input type="checkbox" id="edit-range-from-start" ${fromStart ? 'checked' : ''}>
                        <span>From Start</span>
                    </label>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">To</label>
                    <input type="number" id="edit-range-end" min="1" max="${currentTotalRounds}" value="${initEnd}" ${toEnd ? 'disabled' : ''} style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${toEnd ? 'opacity:0.5; cursor:not-allowed;' : ''}">
                    <label class="custom-checkbox-label" style="margin-top: 6px; font-size: 11px;">
                        <input type="checkbox" id="edit-range-to-end" ${toEnd ? 'checked' : ''}>
                        <span>To End</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- Row 2: Standings Columns Configuration -->
        <div style="margin-top: 5px;">
            <button type="button" id="btn-stage-cols-edit" style="width: 100%; padding: 8px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); border-radius: 4px; cursor: pointer; font-weight: bold; display:flex; justify-content:center; align-items:center; gap:8px;">
                ${getIcon('gear', 14)} Configure Standings Columns
            </button>
        </div>
    `;

    // Row 3: Swiss Pairing Basis (Swiss Only) ok why the fuck did I write that in the parentheses???
    if (config.type === "swiss" || config.type === "dpw_swiss") {
        html += `
            <div style="margin-top: 10px; border-top: 1px solid var(--border-main); padding-top: 12px;">
                <button type="button" id="btn-open-swiss-pairing-config" ${isStarted ? 'disabled' : ''} style="width: 100%; padding: 8px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); border-radius: 4px; font-weight: bold; display: flex; justify-content: center; align-items: center; gap: 8px; ${isStarted ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'}">
                    ${getIcon('gear', 14)} Configure Swiss Pairing Engine
                </button>
            </div>
        `;
    }

    // Row 4: Stage Tiebreakers Configure Button
    if (!isCompleted) {
        html += `
            <div style="margin-top: 10px; border-top: 1px solid var(--border-main); padding-top: 15px;">
                <button id="btn-stage-tb-edit" style="width: 100%; padding: 8px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); cursor: pointer; font-weight: bold; display:flex; justify-content:center; align-items:center; gap:8px;">
                    <span data-icon="scale" data-size="14"></span> Edit Stage Tiebreakers
                </button>
            </div>
        `;
    }

    // Row 5: Lock Standings Checkbox
    html += `
        <div style="margin-top: 10px; border-top: 1px solid var(--border-main); padding-top: 15px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="edit-stage-lock" ${config.lockStandings ? 'checked' : ''}>
                <span style="font-size:12px; color:var(--text-main);">Lock Standings (Freeze leaderboard at stage completion)</span>
            </label>
        </div>
    `;

    fieldsContainer.innerHTML = html;
    modal.style.display = 'flex';

    // Hook up the Swiss Pairing Engine Button
    const swissCfgBtn = document.getElementById('btn-open-swiss-pairing-config');
    if (swissCfgBtn && !isStarted) {
        swissCfgBtn.onclick = () => {
            openSwissConfigModal(config, config.type === "dpw_swiss", (updatedConfig) => {
                // Settings saved in config draft
            });
        };
    }

    // 2. clamp visually on blur or Enter
    const roundsInput = document.getElementById('edit-stage-rounds');
    if (roundsInput) {
        const clamp = () => {
            const val = parseInt(roundsInput.value);
            if (isNaN(val)) {
                roundsInput.value = '';
            } else {
                roundsInput.value = Math.max(roundsPlayed, val);
            }
        };
        roundsInput.onblur = clamp;
        roundsInput.onkeydown = (e) => { if (e.key === "Enter") clamp(); };
    }

    const cutInput = document.getElementById('edit-stage-cut');
    const rangeStartInput = document.getElementById('edit-range-start');
    const rangeEndInput = document.getElementById('edit-range-end');
    const chkFromStart = document.getElementById('edit-range-from-start');
    const chkToEnd = document.getElementById('edit-range-to-end');

    function recomputeTotalRounds() {
        const mr = roundsInput ? parseInt(roundsInput.value) : NaN;
        const cutVal = (cutInput && !isStarted) ? parseInt(cutInput.value) : NaN;
        currentTotalRounds = getStageTotalRounds(
            config,
            stage,
            tournament,
            (!isNaN(mr) && mr > 0) ? mr : undefined,
            (!isNaN(cutVal) && cutVal > 0) ? cutVal : undefined
        );
        rangeStartInput.max = currentTotalRounds;
        rangeEndInput.max = currentTotalRounds;

        if (chkToEnd.checked || !toDirty) {
            rangeEndInput.value = currentTotalRounds;
        } else {
            let curEnd = parseInt(rangeEndInput.value);
            if (isNaN(curEnd)) curEnd = currentTotalRounds;
            rangeEndInput.value = Math.max(1, Math.min(currentTotalRounds, curEnd));
        }

        if (chkFromStart.checked) {
            rangeStartInput.value = 1;
        } else {
            const maxAllowedStart = parseInt(rangeEndInput.value) || currentTotalRounds;
            let curStart = parseInt(rangeStartInput.value);
            if (isNaN(curStart)) curStart = 1;
            rangeStartInput.value = Math.max(1, Math.min(maxAllowedStart, curStart));
        }
    }

    function clampFrom() {
        const maxTo = chkToEnd.checked ? currentTotalRounds : (parseInt(rangeEndInput.value) || currentTotalRounds);
        let val = parseInt(rangeStartInput.value);
        if (isNaN(val)) val = 1;
        rangeStartInput.value = Math.max(1, Math.min(maxTo, val));
    }

    function clampTo() {
        const minFrom = chkFromStart.checked ? 1 : (parseInt(rangeStartInput.value) || 1);
        let val = parseInt(rangeEndInput.value);
        if (isNaN(val)) val = currentTotalRounds;
        rangeEndInput.value = Math.max(minFrom, Math.min(currentTotalRounds, val));
    }

    if (roundsInput) {
        const prevBlur = roundsInput.onblur;
        const prevKey = roundsInput.onkeydown;
        roundsInput.oninput = recomputeTotalRounds;
        roundsInput.onblur = () => { if (prevBlur) prevBlur(); recomputeTotalRounds(); };
        roundsInput.onkeydown = (e) => { if (prevKey) prevKey(e); if (e.key === "Enter") recomputeTotalRounds(); };
    }
    if (cutInput && !isStarted) {
        cutInput.oninput = recomputeTotalRounds;
    }

    chkFromStart.onchange = () => {
        const locked = chkFromStart.checked;
        rangeStartInput.disabled = locked;
        rangeStartInput.style.opacity = locked ? '0.5' : '1';
        rangeStartInput.style.cursor = locked ? 'not-allowed' : '';
        if (locked) rangeStartInput.value = 1;
    };

    chkToEnd.onchange = () => {
        const locked = chkToEnd.checked;
        rangeEndInput.disabled = locked;
        rangeEndInput.style.opacity = locked ? '0.5' : '1';
        rangeEndInput.style.cursor = locked ? 'not-allowed' : '';
        if (locked) {
            toDirty = false;
            rangeEndInput.value = currentTotalRounds;
        }
    };

    rangeStartInput.onblur = clampFrom;
    rangeStartInput.onkeydown = (e) => { if (e.key === "Enter") clampFrom(); };

    rangeEndInput.oninput = () => { toDirty = true; };
    rangeEndInput.onchange = () => { toDirty = true; clampTo(); };
    rangeEndInput.onblur = clampTo;
    rangeEndInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            toDirty = true;
            clampTo();
        }
    };

    // 3. Open Tiebreaker Modal Handler
    const tbBtn = document.getElementById('btn-stage-tb-edit');
    if (tbBtn) {
        tbBtn.querySelector('span').innerHTML = getIcon('scale', 14);
        tbBtn.onclick = () => {
            window.activeEditTiebreakersTarget = tempTiebreakers; 
            window.activeEditTiebreakersCallback = (newRules) => {
                tempTiebreakers = newRules; // Update draft, NOT config like before...
            };
            document.getElementById('btn-open-tb-builder').click();
        };
    }

    // 3.5. Open Stage Columns Editor
    const colsBtn = document.getElementById('btn-stage-cols-edit');
    if (colsBtn) {
        colsBtn.onclick = () => {
            openStandingsColumnsModal(config, () => {
                // Draft updated in-place on config
            });
        };
    }

    // 4. Close handlers (Safely discards draft and purges stale globals)
    const close = () => { 
        window.activeEditTiebreakersTarget = null;
        window.activeEditTiebreakersCallback = null;
        modal.style.display = 'none'; 
    };
    document.getElementById('btn-close-stage-settings').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 5. Save Handler (Commits draft to config)
    document.getElementById('btn-save-stage-settings').onclick = async () => {
        // Snapshot for rollback in case of storage failure
        const previousConfigSnapshot = JSON.parse(JSON.stringify(config));
        const previousTotalRounds = isStarted ? stage.data.totalRounds : undefined;

        if (roundsInput) {
            const val = parseInt(roundsInput.value);
            if (isNaN(val)) {
                config.maxRounds = undefined;
                if (isStarted) stage.data.totalRounds = defaultRounds;
            } else {
                config.maxRounds = Math.max(roundsPlayed, val);
                if (isStarted) stage.data.totalRounds = config.maxRounds;
            }
        }

        if (document.getElementById('edit-stage-cut') && !isStarted) {
            const val = parseInt(document.getElementById('edit-stage-cut').value);
            config.cutToTop = (!isNaN(val) && val > 0) ? val : undefined;
        }

        if (document.getElementById('edit-stage-lock')) {
            config.lockStandings = document.getElementById('edit-stage-lock').checked;
        }

        // commit tmp tiebreaker
        config.tiebreakers = tempTiebreakers; 

        // 
        recomputeTotalRounds();
        config.rangeFromStart = chkFromStart.checked;
        config.rangeToEnd = chkToEnd.checked;
        config.rangeEndCustom = !chkToEnd.checked && toDirty;

        if (!config.rangeFromStart) {
            clampFrom();
            config.rangeStart = parseInt(rangeStartInput.value) || 1;
        } else {
            config.rangeStart = 1;
        }

        if (!config.rangeToEnd) {
            clampTo();
            config.rangeEnd = parseInt(rangeEndInput.value) || currentTotalRounds;
        } else {
            delete config.rangeEnd;
        }

        // hopemaxxing UI close and redraw
        close();
        onComplete();

        // storage write w/ retry  rollback
        try {
            await saveTournamentLocally(tournament);
        } catch (saveErr) {
            // console.warn("Stage settings save failed. Retrying once...", saveErr);
            try {
                await saveTournamentLocally(tournament);
            } catch (retryErr) {
                // console.error("Critical storage error: could not save stage settings.", retryErr);
                // Rollback config to prior snapshot so UI matches true storage
                Object.keys(config).forEach(k => delete config[k]);   // Purges keys
                Object.assign(config, previousConfigSnapshot);        // Restores the original props
                if (isStarted) stage.data.totalRounds = previousTotalRounds; // Restores stage.data.totalRounds
                onComplete();
                alert("Storage Error: Failed to save stage settings to storage.");
            }
        }
    };
}

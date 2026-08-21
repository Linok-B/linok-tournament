import { getIcon } from './icons.js';

export function openStageSettingsModal(stageIndex, tournament, onComplete) {
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
        
        <!-- Row 2: Leaderboard Points Display -->
        <div>
            <label style="font-size:11px; color:var(--text-muted);">Leaderboard Points Display</label>
            <select id="edit-stage-display" style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                <option value="match_points" ${config.pointsColumnDisplay !== "game_points" ? 'selected' : ''}>Match Points</option>
                <option value="game_points" ${config.pointsColumnDisplay === "game_points" ? 'selected' : ''}>Game Points</option>
            </select>
        </div>
    `;

    // Row 3: Swiss Pairing Basis (Swiss Only)
    if (config.type === "swiss" || config.type === "dpw_swiss") {
        html += `
            <div>
                <label style="font-size:11px; color:var(--text-muted);">Swiss Pairing Basis</label>
                <select id="edit-stage-pairing" ${isStarted ? 'disabled' : ''} style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isStarted ? 'opacity:0.5; cursor:not-allowed;' : ''}">
                    <option value="match_points" ${config.swissPairingBasis !== "game_points" ? 'selected' : ''}>Match Points</option>
                    <option value="game_points" ${config.swissPairingBasis === "game_points" ? 'selected' : ''}>Game Points</option>
                </select>
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

    // 4. Close handlers (Safely discards draft and purges stale globals)
    const close = () => { 
        window.activeEditTiebreakersTarget = null;
        window.activeEditTiebreakersCallback = null;
        modal.style.display = 'none'; 
    };
    document.getElementById('btn-close-stage-settings').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 5. Save Handler (Commits draft to config)
    document.getElementById('btn-save-stage-settings').onclick = () => {
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

        if (document.getElementById('edit-stage-display')) {
            config.pointsColumnDisplay = document.getElementById('edit-stage-display').value;
        }

        if (document.getElementById('edit-stage-pairing') && !isStarted) {
            config.swissPairingBasis = document.getElementById('edit-stage-pairing').value;
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

        close();
        onComplete();
    };
}

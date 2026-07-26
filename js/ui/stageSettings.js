import { getIcon } from './icons.js';

export function openStageSettingsModal(stageIndex, tournament, onComplete) {
    const modal = document.getElementById('stage-settings-modal');
    const fieldsContainer = document.getElementById('stage-settings-fields');
    
    // Check if the stage has already started
    const isStarted = stageIndex < tournament.stages.length;
    const stage = isStarted ? tournament.stages[stageIndex] : null;
    const config = isStarted ? stage.config : tournament.settings.pipeline[stageIndex];
    
    // Rounds Played
    const roundsPlayed = isStarted ? stage.data.rounds.length : 1;
    const defaultRounds = Math.ceil(Math.log2(tournament.players.length));

    document.getElementById('stage-settings-title').innerHTML = `${getIcon('gear', 24)} Stage ${stageIndex + 1} Settings`;

    // 1. Generate Fields dynamically based on stage type
    let html = ``;

    if (config.type === "swiss" || config.type === "dpw_swiss" || config.type === "round_robin") {
        html += `
            <div>
                <label style="font-size:11px; color:var(--text-muted);">Max Rounds ${isStarted ? `(Min: ${roundsPlayed} played)` : ''}</label>
                <input type="number" id="edit-stage-rounds" min="${roundsPlayed}" value="${config.maxRounds || defaultRounds}" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
            </div>
            
            <div>
                <label style="font-size:11px; color:var(--text-muted);">Leaderboard Points Display</label>
                <select id="edit-stage-display" style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                    <option value="match_points" ${config.pointsColumnDisplay !== "game_points" ? 'selected' : ''}>Match Points</option>
                    <option value="game_points" ${config.pointsColumnDisplay === "game_points" ? 'selected' : ''}>Game Points</option>
                </select>
            </div>
        `;

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
    }

    // Top Cut (always show for all stages, but disable if started)
    html += `
        <div>
            <label style="font-size:11px; color:var(--text-muted);">Top Cut (From previous stage)</label>
            <input type="number" id="edit-stage-cut" ${isStarted ? 'disabled' : ''} value="${config.cutToTop || ''}" placeholder="All" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isStarted ? 'opacity:0.5; cursor:not-allowed;' : ''}">
        </div>
    `;

    // Add Tiebreaker configuration button if unstarted
    if (!isStarted) {
        html += `
            <div style="margin-top: 10px; border-top: 1px solid var(--border-main); padding-top: 15px;">
                <button id="btn-stage-tb-edit" style="width: 100%; padding: 8px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); cursor: pointer; font-weight: bold; display:flex; justify-content:center; align-items:center; gap:8px;">
                    <span data-icon="scale" data-size="14"></span> Edit Stage Tiebreakers
                </button>
            </div>
        `;
    }

    fieldsContainer.innerHTML = html;
    modal.style.display = 'flex';

    // 2. visually on blur or Enter
    const roundsInput = document.getElementById('edit-stage-rounds');
    if (roundsInput) {
        const clamp = () => {
            const val = parseInt(roundsInput.value) || defaultRounds;
            roundsInput.value = Math.max(roundsPlayed, val);
        };
        roundsInput.onblur = clamp;
        roundsInput.onkeydown = (e) => { if (e.key === "Enter") clamp(); };
    }

    // workable click handler
    const tbBtn = document.getElementById('btn-stage-tb-edit');
    if (tbBtn) {
        tbBtn.querySelector('span').innerHTML = getIcon('scale', 14);
        tbBtn.onclick = () => {
            window.activeEditTiebreakersTarget = config.tiebreakers || [];
            window.activeEditTiebreakersCallback = (newRules) => {
                config.tiebreakers = newRules;
            };
            document.getElementById('btn-open-tb-builder').click();
        };
    }

    // 3. Close handlers
    const close = () => { modal.style.display = 'none'; };
    document.getElementById('btn-close-stage-settings').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 4. Save Handler
    document.getElementById('btn-save-stage-settings').onclick = () => {
        if (roundsInput) {
            const enteredRounds = parseInt(roundsInput.value) || defaultRounds;
            config.maxRounds = Math.max(roundsPlayed, enteredRounds);
            if (isStarted) stage.data.totalRounds = config.maxRounds;
        }

        // Read Soft Display Change
        if (document.getElementById('edit-stage-display')) {
            config.pointsColumnDisplay = document.getElementById('edit-stage-display').value;
        }

        // Read Pairing Basis
        if (document.getElementById('edit-stage-pairing') && !isStarted) {
            config.swissPairingBasis = document.getElementById('edit-stage-pairing').value;
        }

        // Read Top Cut (Only if unstarted)
        if (document.getElementById('edit-stage-cut') && !isStarted) {
            const val = parseInt(document.getElementById('edit-stage-cut').value);
            config.cutToTop = (!isNaN(val) && val > 0) ? val : undefined;
        }

        close();
        onComplete();
    };
}

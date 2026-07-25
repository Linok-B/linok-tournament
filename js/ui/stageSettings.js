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
                    <option value="match_points" ${config.pointsColumnDisplay === "match_points" ? 'selected' : ''}>Match Points</option>
                    <option value="game_points" ${config.pointsColumnDisplay === "game_points" ? 'selected' : ''}>Game Points</option>
                </select>
            </div>
        `;

        if (config.type === "swiss" || config.type === "dpw_swiss") {
            html += `
                <div>
                    <label style="font-size:11px; color:var(--text-muted);">Swiss Pairing Basis</label>
                    <select id="edit-stage-pairing" ${isStarted ? 'disabled' : ''} style="width: 100%; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isStarted ? 'opacity:0.5; cursor:not-allowed;' : ''}">
                        <option value="match_points" ${config.swissPairingBasis === "match_points" ? 'selected' : ''}>Match Points</option>
                        <option value="game_points" ${config.swissPairingBasis === "game_points" ? 'selected' : ''}>Game Points</option>
                    </select>
                </div>
            `;
        }
    }

    // Top Cut (Only applicable if there's a previous stage)
    if (stageIndex > 0) {
        html += `
            <div>
                <label style="font-size:11px; color:var(--text-muted);">Top Cut (From previous stage)</label>
                <input type="number" id="edit-stage-cut" ${isStarted ? 'disabled' : ''} value="${config.cutToTop || ''}" placeholder="All" style="width: 100%; box-sizing: border-box; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main); ${isStarted ? 'opacity:0.5; cursor:not-allowed;' : ''}">
            </div>
        `;
    }

    fieldsContainer.innerHTML = html;
    modal.style.display = 'flex';

    // 2. Close handlers
    const close = () => { modal.style.display = 'none'; };
    document.getElementById('btn-close-stage-settings').onclick = close;
    
    // Close on click outside
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 3. Save Handler
    document.getElementById('btn-save-stage-settings').onclick = () => {
        // Read & Clamp rounds
        if (document.getElementById('edit-stage-rounds')) {
            const enteredRounds = parseInt(document.getElementById('edit-stage-rounds').value) || defaultRounds;
            config.maxRounds = Math.max(roundsPlayed, enteredRounds);
            
            // If stage is active, also update its live totalRounds variable
            if (isStarted) {
                stage.data.totalRounds = config.maxRounds;
            }
        }

        // Read Soft Display Change
        if (document.getElementById('edit-stage-display')) {
            config.pointsColumnDisplay = document.getElementById('edit-stage-display').value;
        }

        // Read Pairing Basis (Only if unstarted)
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
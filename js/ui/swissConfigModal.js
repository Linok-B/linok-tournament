import { getIcon } from './icons.js';

export function openSwissConfigModal(config, isDPW, onSave) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:10000; display:flex; justify-content:center; align-items:center;";

    const modal = document.createElement('div');
    modal.style.cssText = "background:var(--bg-panel); border:2px solid var(--accent); border-radius:8px; width:480px; max-width:92vw; padding:25px; display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box; color:var(--text-main);";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const draft = {
        algorithm: config.pairingAlgorithm || "mrv",
        greedyMode: config.greedyMode || "backtracking",
        blossomMode: config.blossomMode || "topk",
        orderMode: config.orderMode || "fisher_yates",
        round1Mode: config.round1Mode || "sequential",
        cdclMode: config.cdclMode !== undefined ? config.cdclMode : 1,
        midDegreeThreshold: config.midDegreeThreshold !== undefined ? config.midDegreeThreshold : 6,
        microHuntBudget: config.microHuntBudget || 8000,
        pairingBasis: isDPW ? "dpw_rating" : (config.swissPairingBasis || "match_points"),
        inheritTiebreakers: false,
        customTiebreakers: isDPW ? ["team_score"] : [],
        maxCandidates: config.maxCandidates || (config.pairingAlgorithm === "blossom" ? 100 : 1000),
        timeoutMs: config.timeoutMs || 5000
    };

    function formatTime(val) {
        if (isNaN(val) || val <= 0) return "5.00 seconds (Default)";
        if (val < 0.001) return `${(val * 1000000).toFixed(1)} ns`;
        if (val < 1) return `${(val * 1000).toFixed(1)} µs`;
        if (val < 1000) return `${val} ms`;
        if (val < 60000) return `${(val / 1000).toFixed(2)} seconds`;
        if (val < 3600000) return `${(val / 60000).toFixed(2)} minutes`;
        if (val < 86400000) return `${(val / 3600000).toFixed(2)} hours`;
        return `${(val / 86400000).toFixed(2)} days`;
    }

    function render() {
        const isMRV = draft.algorithm === "mrv";
        const isGreedy = draft.algorithm === "greedy";
        const isBlossom = draft.algorithm === "blossom";
        const isDutch = draft.algorithm === "dutch";

        const hasBacktrack = isMRV || (isGreedy && draft.greedyMode === "backtracking") || (isBlossom && draft.blossomMode === "topk");
        const hasOrderMode = isMRV || (isGreedy && draft.greedyMode === "backtracking");
        const hasCDCL = isMRV || (isGreedy && draft.greedyMode === "backtracking") || (isBlossom && draft.blossomMode === "topk");

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:var(--accent); display:flex; align-items:center; gap:8px;">
                    ${getIcon('gear', 20)} Swiss Pairing Configuration
                </h3>
                <button id="btn-close-swiss-config" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:18px;">X</button>
            </div>

            <div style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:14px; padding-right:5px;">
                
                <!-- 1. Algorithm Selector -->
                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Pairing Algorithm</label>
                    <select id="cfg-algo" style="width:100%; padding:7px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                        <option value="mrv" title="Minimum Remaining Values" ${isMRV ? 'selected' : ''}>MRV</option>
                        <option value="blossom" title="Edmonds' Blossom" ${isBlossom ? 'selected' : ''}>Blossom</option>
                        <option value="greedy" title="Greedy sequential index scanner" ${isGreedy ? 'selected' : ''}>Greedy</option>
                        <option value="dutch" title="Dutch System Article C3" ${isDutch ? 'selected' : ''}>Dutch System</option>
                    </select>
                </div>
            
                <!-- 2. Pairing Method -->
                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Round 1 Pairing Method</label>
                    <select id="cfg-round1-mode" style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                        <option value="sequential" title="Sequential Order (1v2, 3v4, 5v6...)" ${draft.round1Mode === 'sequential' ? 'selected' : ''}>Sequential Order</option>
                        <option value="folded" title="Folded Seed (1vN, 2vN-1, 3vN-2...)" ${draft.round1Mode === 'folded' ? 'selected' : ''}>Folded Seed</option>
                        <option value="halves" title="Split Halves (1 vs N/2+1, 2 vs N/2+2...)" ${draft.round1Mode === 'halves' ? 'selected' : ''}>Split Halves</option>
                    </select>
                </div>

                ${isGreedy ? `
                    <div style="background:var(--bg-dark); border:1px solid var(--border-main); padding:10px; border-radius:4px; display:flex; flex-direction:column; gap:10px;">
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Greedy Mode</label>
                            <select id="cfg-greedy-mode" style="width:100%; padding:6px; background:var(--bg-panel); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                                <option value="backtracking" title="Backtracking search: explores alternate branches when dead ends occur." ${draft.greedyMode === 'backtracking' ? 'selected' : ''}>Backtracking</option>
                                <option value="plain" title="Plain forward scan only: single-pass scanner without branch exploration." ${draft.greedyMode === 'plain' ? 'selected' : ''}>Plain</option>
                            </select>
                        </div>
                    </div>
                ` : ''}

                ${isBlossom ? `
                    <div style="background:var(--bg-dark); border:1px solid var(--border-main); padding:10px; border-radius:4px; display:flex; flex-direction:column; gap:10px;">
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Blossom Mode</label>
                            <select id="cfg-blossom-mode" style="width:100%; padding:6px; background:var(--bg-panel); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                                <option value="topk" title="Murty's K-best partition enumeration with residual CDCL safety lookahead." ${draft.blossomMode === 'topk' ? 'selected' : ''}>Top-K Blossom</option>
                                <option value="standard" title="Single-pass maximum weight matching without candidate lookahead." ${draft.blossomMode === 'standard' ? 'selected' : ''}>Standard Blossom</option>
                            </select>
                        </div>
                    </div>
                ` : ''}

                ${hasOrderMode ? `
                    <div>
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Tie Group Pre-Shuffle</label>
                        <select id="cfg-order-mode" style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                            <option value="fisher_yates" title="Recommended: Randomized shuffle of tied score groups prior to sorting." ${draft.orderMode === 'fisher_yates' ? 'selected' : ''}>Fisher-Yates</option>
                            <option value="og" title="Preserve Order: Preserves previous round player sequence on tied scores." ${draft.orderMode === 'og' ? 'selected' : ''}>OG Mode</option>
                        </select>
                    </div>
                ` : ''}

                ${hasCDCL ? `
                    <div>
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">CDCL 1-Factor Safety Lookahead</label>
                        <select id="cfg-cdcl-mode" style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                            <option value="1" title="Default: Runs SAT factorability verification on residual degrees 3 to 6." ${draft.cdclMode === 1 ? 'selected' : ''}>Mid Mode</option>
                            <option value="2" title="Mathematical guarantee: Runs SAT verification on residual degrees 3 to N/2." ${draft.cdclMode === 2 ? 'selected' : ''}>Max Mode</option>
                            <option value="0" title="Disables SAT lookahead verification." ${draft.cdclMode === 0 ? 'selected' : ''}>Disabled</option>
                        </select>
                    </div>
                ` : ''}

                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Swiss Pairing Basis</label>
                    <select id="cfg-basis" ${isDPW ? 'disabled' : ''} style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px; ${isDPW ? 'opacity:0.6; cursor:not-allowed;' : ''}">
                        <option value="match_points" ${draft.pairingBasis === 'match_points' ? 'selected' : ''}>Match Points</option>
                        <option value="game_points" ${draft.pairingBasis === 'game_points' ? 'selected' : ''}>Game Points</option>
                        <option value="dpw_rating" ${draft.pairingBasis === 'dpw_rating' ? 'selected' : ''}>DPW Rating</option>
                    </select>
                </div>

                <div style="border-top:1px solid var(--border-main); padding-top:10px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; margin-bottom:8px;">
                        <input type="checkbox" id="cfg-inherit-tb" ${draft.inheritTiebreakers ? 'checked' : ''}>
                        <span>Inherit Stage Leaderboard Tiebreakers for Matchmaking</span>
                    </label>
                    <button id="btn-cfg-edit-tb" ${draft.inheritTiebreakers ? 'disabled style="display:none;"' : ''} style="width:100%; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px; cursor:pointer; font-size:12px; display:flex; justify-content:center; align-items:center; gap:6px;">
                        ${getIcon('scale', 14)} Configure Custom Matchmaking Tiebreakers (${draft.customTiebreakers.length} Rules)
                    </button>
                </div>

                ${hasBacktrack ? `
                    <div style="border-top:1px solid var(--border-main); padding-top:10px; display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Max Candidates</label>
                            <input type="number" id="cfg-cand" min="1" value="${draft.maxCandidates}" style="width:100%; box-sizing:border-box; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Time Limit (ms)</label>
                            <input type="number" id="cfg-timeout" min="1" value="${draft.timeoutMs}" style="width:100%; box-sizing:border-box; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                            <small id="cfg-time-preview" style="display:block; font-size:10px; color:var(--text-muted); margin-top:3px;">${formatTime(draft.timeoutMs)}</small>
                        </div>
                    </div>
                ` : ''}
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-main); padding-top:15px; margin-top:15px;">
                <button id="btn-cfg-cancel" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-main); border-radius:4px; padding:8px 16px; cursor:pointer;">Cancel</button>
                <button id="btn-cfg-save" style="background:var(--accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:8px 20px; font-weight:bold; cursor:pointer;">Save Configuration</button>
            </div>
        `;

        document.getElementById('btn-close-swiss-config').onclick = () => overlay.remove();
        document.getElementById('btn-cfg-cancel').onclick = () => overlay.remove();

        document.getElementById('cfg-algo').onchange = (e) => {
            draft.algorithm = e.target.value;
            if (draft.algorithm === "blossom") draft.maxCandidates = 100;
            else draft.maxCandidates = 1000;
            render();
        };

        if (document.getElementById('cfg-greedy-mode')) {
            document.getElementById('cfg-greedy-mode').onchange = (e) => {
                draft.greedyMode = e.target.value;
                render();
            };
        }

        if (document.getElementById('cfg-blossom-mode')) {
            document.getElementById('cfg-blossom-mode').onchange = (e) => {
                draft.blossomMode = e.target.value;
                render();
            };
        }

        if (document.getElementById('cfg-order-mode')) {
            document.getElementById('cfg-order-mode').onchange = (e) => {
                draft.orderMode = e.target.value;
            };
        }

        if (document.getElementById('cfg-cdcl-mode')) {
            document.getElementById('cfg-cdcl-mode').onchange = (e) => {
                draft.cdclMode = parseInt(e.target.value);
            };
        }

        if (document.getElementById('cfg-basis') && !isDPW) {
            document.getElementById('cfg-basis').onchange = (e) => {
                draft.pairingBasis = e.target.value;
            };
        }

        document.getElementById('cfg-inherit-tb').onchange = (e) => {
            draft.inheritTiebreakers = e.target.checked;
            render();
        };

        document.getElementById('cfg-round1-mode').onchange = (e) => {
            draft.round1Mode = e.target.value;
        };

        if (document.getElementById('btn-cfg-edit-tb')) {
            document.getElementById('btn-cfg-edit-tb').onclick = () => {
                window.activeEditTiebreakersTarget = draft.customTiebreakers;
                window.activeEditTiebreakersCallback = (newRules) => {
                    draft.customTiebreakers = newRules;
                    render();
                };
                document.getElementById('btn-open-tb-builder').click();
            };
        }

        const timeoutInput = document.getElementById('cfg-timeout');
        if (timeoutInput) {
            timeoutInput.oninput = (e) => {
                const val = parseFloat(e.target.value);
                const preview = document.getElementById('cfg-time-preview');
                if (preview) preview.innerText = formatTime(val);
            };
            timeoutInput.onblur = (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val <= 0) val = 5000;
                e.target.value = val;
                draft.timeoutMs = val;
                const preview = document.getElementById('cfg-time-preview');
                if (preview) preview.innerText = formatTime(val);
            };
        }

        const candInput = document.getElementById('cfg-cand');
        if (candInput) {
            candInput.onblur = (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val <= 0) val = (draft.algorithm === "blossom" ? 100 : 1000);
                e.target.value = val;
                draft.maxCandidates = val;
            };
        }

        document.getElementById('btn-cfg-save').onclick = () => {
            config.pairingAlgorithm = draft.algorithm;
            config.greedyMode = draft.greedyMode;
            config.blossomMode = draft.blossomMode;
            config.orderMode = draft.orderMode;
            config.cdclMode = draft.cdclMode;
            config.midDegreeThreshold = draft.midDegreeThreshold;
            config.microHuntBudget = draft.microHuntBudget;
            config.swissPairingBasis = draft.pairingBasis;
            config.round1Mode = draft.round1Mode;
            config.inheritTiebreakers = draft.inheritTiebreakers;
            config.pairingTiebreakers = draft.customTiebreakers;
            config.maxCandidates = draft.maxCandidates;
            config.timeoutMs = draft.timeoutMs;

            overlay.remove();
            onSave(config);
        };
    }

    render();
}

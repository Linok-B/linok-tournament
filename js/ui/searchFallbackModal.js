import { getIcon } from './icons.js';

export function openSearchFallbackModal({ limitType, n, players, candidatePairs, playedMatrix, currentRound, onResume, onAcceptDoomed, onManualPair }) {
    const prevBeforeUnload = window.onbeforeunload;
    window.onbeforeunload = (e) => {
        e.preventDefault();
        return (e.returnValue = "Matchmaking resolution is in progress. Leaving may lose tournament state.");
    };

    const cleanup = () => {
        window.onbeforeunload = prevBeforeUnload;
        overlay.remove();
    };

    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;";

    const modal = document.createElement('div');
    modal.style.cssText = "background:var(--bg-panel); border:2px solid var(--warning); border-radius:8px; width:520px; max-width:92vw; padding:25px; display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box; color:var(--text-main);";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

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

    function renderPrompt() {
        const isTimeLimit = limitType === "timeout";
        const limitMsg = isTimeLimit 
            ? "The matchmaking search exceeded its allocated Time Limit before finding a CDCL-safe 1-factorable pairing."
            : "The matchmaking search hit its Maximum Candidate Limit without finding a CDCL-safe 1-factorable pairing.";

        modal.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:12px;">
                <span style="color:var(--warning); display:flex; align-items:center;">${getIcon('warning', 28)}</span>
                <h2 style="margin:0; color:var(--warning); text-align:center;">${isTimeLimit ? 'TIME LIMIT EXCEEDED' : 'CANDIDATE LIMIT HIT'}</h2>
            </div>
            
            <p style="font-size:13px; line-height:1.5; text-align:center; color:var(--text-main); margin-top:0;">${limitMsg}</p>
            <p style="font-size:12px; color:var(--text-muted); text-align:center;">How would you like to proceed with Round ${currentRound}?</p>

            <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                <button id="btn-fallback-resume" style="background:var(--accent); color:var(--text-on-accent); padding:12px; border-radius:4px; border:none; cursor:pointer; font-weight:bold; text-align:left;">
                    <strong>1. Continue Searching</strong><br>
                    <small style="font-weight:normal; opacity:0.85;">Allow more candidate checks or computation time to find a factorable pairing.</small>
                </button>

                <button id="btn-fallback-accept" style="background:var(--warning); color:var(--text-on-accent); padding:12px; border-radius:4px; border:none; cursor:pointer; font-weight:bold; text-align:left;">
                    <strong>2. Proceed with Best Available Pairing</strong><br>
                    <small style="font-weight:normal; opacity:0.85;">Uses the highest-ranked matching found (CDCL safety will enter passive observation mode).</small>
                </button>

                <button id="btn-fallback-manual" style="background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); padding:12px; border-radius:4px; cursor:pointer; font-weight:bold; text-align:left;">
                    <strong>3. Manually Configure Round Pairings</strong><br>
                    <small style="font-weight:normal; opacity:0.85; color:var(--text-muted);">Open a drag-and-drop pairing board pre-populated with the best pairing.</small>
                </button>
            </div>
        `;

        document.getElementById('btn-fallback-resume').onclick = renderResumeModal;
        document.getElementById('btn-fallback-accept').onclick = () => {
            cleanup();
            onAcceptDoomed(candidatePairs);
        };
        document.getElementById('btn-fallback-manual').onclick = renderManualBoard;
    }

    function renderResumeModal() {
        let extraCand = 1000;
        let extraTime = 5000;

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:var(--accent); display:flex; align-items:center; gap:8px;">
                    ${getIcon('gear', 18)} Set Additional Search Allowance
                </h3>
            </div>
            
            <p style="font-size:12px; color:var(--text-muted); margin-top:0;">Configure how much additional budget to grant before prompting again:</p>

            <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px;">
                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Additional Candidate Limit</label>
                    <input type="number" id="in-extra-cand" min="1" value="${extraCand}" style="width:100%; box-sizing:border-box; padding:8px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                </div>

                <div>
                    <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Additional Time Limit (ms)</label>
                    <input type="number" id="in-extra-time" min="1" value="${extraTime}" style="width:100%; box-sizing:border-box; padding:8px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px;">
                    <small id="lbl-time-preview" style="font-size:11px; color:var(--text-muted); display:block; margin-top:4px;">${formatTime(extraTime)}</small>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-main); padding-top:15px;">
                <button id="btn-resume-back" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-size:13px; font-weight:bold;">← Back</button>
                <button id="btn-resume-start" style="background:var(--accent); color:var(--text-on-accent); padding:10px 20px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Resume Search</button>
            </div>
        `;

        document.getElementById('btn-resume-back').onclick = renderPrompt;

        const timeIn = document.getElementById('in-extra-time');
        timeIn.oninput = (e) => {
            const v = parseFloat(e.target.value);
            document.getElementById('lbl-time-preview').innerText = formatTime(v);
        };
        timeIn.onblur = (e) => {
            let v = parseInt(e.target.value);
            if (isNaN(v) || v <= 0) v = 5000;
            e.target.value = v;
            document.getElementById('lbl-time-preview').innerText = formatTime(v);
        };

        const candIn = document.getElementById('in-extra-cand');
        candIn.onblur = (e) => {
            let v = parseInt(e.target.value);
            if (isNaN(v) || v <= 0) v = 1000;
            e.target.value = v;
        };

        document.getElementById('btn-resume-start').onclick = () => {
            const c = parseInt(candIn.value) || 1000;
            const t = parseInt(timeIn.value) || 5000;
            cleanup();
            onResume({ extraCandidates: c, extraTimeoutMs: t });
        };
    }

    function renderManualBoard() {
        let currentPairs = candidatePairs.map(([u, v]) => [u, v]);

        function checkRematch(u, v) {
            if (u === null || v === null || u === v) return false;
            const word_v = Math.floor(v / 64);
            const bit_v = BigInt(v % 64);
            return ((playedMatrix[u][word_v] & (1n << bit_v)) !== 0n);
        }

        modal.style.width = "640px";
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:12px;">
                <h3 style="margin:0; color:var(--accent);">Manual Round ${currentRound} Pairings</h3>
                <button id="btn-manual-back" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:14px;">← Back</button>
            </div>
            
            <p style="font-size:12px; color:var(--text-muted); margin-top:0;">Drag and swap players between pairing slots:</p>

            <div id="manual-pairs-list" style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:8px; max-height:55vh; padding-right:5px; margin-bottom:15px;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-main); padding-top:12px;">
                <button id="btn-save-manual-pairs" style="background:var(--success); color:var(--text-on-accent); padding:10px 24px; border:none; border-radius:4px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    ${getIcon('check', 16)} Confirm Manual Pairings
                </button>
            </div>
        `;

        document.getElementById('btn-manual-back').onclick = () => {
            modal.style.width = "520px";
            renderPrompt();
        };

        function drawPairs() {
            const list = document.getElementById('manual-pairs-list');
            list.innerHTML = '';

            currentPairs.forEach(([u, v], idx) => {
                const isRematch = checkRematch(u, v);
                const p1 = players[u] || { name: `Player ${u}` };
                const p2 = (v !== null && players[v]) ? players[v] : (v === null ? { name: "BYE" } : { name: `Player ${v}` });

                list.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); border:1px solid ${isRematch ? 'var(--danger)' : 'var(--border-main)'}; border-left:4px solid ${isRematch ? 'var(--danger)' : 'var(--accent)'}; padding:8px 12px; border-radius:4px;">
                        <span style="font-weight:bold; font-size:12px; color:var(--text-muted); width:24px;">#${idx + 1}</span>
                        
                        <div style="display:flex; flex-grow:1; justify-content:space-around; align-items:center;">
                            <span style="font-size:13px; font-weight:bold; color:var(--text-main); padding:4px 8px;">${p1.name}</span>
                            <span style="font-size:11px; color:var(--text-muted); font-weight:bold;">VS</span>
                            <span style="font-size:13px; font-weight:bold; color:var(--text-main); padding:4px 8px;">${p2.name}</span>
                        </div>

                        <span style="font-size:10px; font-weight:bold; display:flex; align-items:center; gap:4px; color:${isRematch ? 'var(--danger)' : 'var(--success)'};">
                            ${isRematch ? `${getIcon('warning', 12)} Rematch` : `${getIcon('check', 12)} Fresh Match`}
                        </span>
                    </div>
                `;
            });
        }

        drawPairs();

        document.getElementById('btn-save-manual-pairs').onclick = () => {
            cleanup();
            onManualPair(currentPairs);
        };
    }

    renderPrompt();
}

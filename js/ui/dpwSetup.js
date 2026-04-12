export function openDPWSetupModal(players, rounds, cut, onComplete, existingConfig = null) {
    const overlay = document.createElement('div');
    // Change background slightly (0.81) so the global app.js listener ignores it (ts should be handled better but whatever)
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.81); z-index:9999; display:flex; justify-content:center; align-items:center;";

    const modal = document.createElement('div');
    modal.style.cssText = "background:var(--bg-panel); border:2px solid var(--accent); border-radius:8px; width:700px; max-width:90vw; padding:20px; display:flex; flex-direction:column; max-height:90vh;";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Safely destroy the modal if user clicks the dark background
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // State Memory
    const cache = existingConfig?.dpwData || { playerJsons: {}, rawTS: {}, unitSVs: {} };

    // --- RENDER PAGE 1: JSON INPUT ---
    function renderPage1() {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0; color:var(--accent);">DPW Swiss Setup (1/2)</h2>
                <button id="dpw-close" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:18px;">X</button>
            </div>
            <p style="font-size:14px; margin-top:0; color:var(--text-main);">Upload/Paste the Team JSON, OR manually input their Team Score (TS).</p>
            <div style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:10px; padding-right:10px; margin-bottom:15px;" id="dpw-player-list">
        `;

        players.forEach(p => {
            const savedJson = cache.playerJsons[p.id] || "";
            const savedRaw = cache.rawTS[p.id] !== undefined ? cache.rawTS[p.id] : "";
            
            html += `
                <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; display:flex; gap:10px; align-items:center;">
                    <strong style="width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.name}">${p.name}</strong>
                    
                    <div style="display:flex; flex-direction:column; flex-grow:1; gap:5px;">
                        <textarea id="json-${p.id}" placeholder="Paste JSON here..." style="height:35px; resize:none; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); padding:5px; font-family:monospace; font-size:11px;">${savedJson}</textarea>
                        
                        <div style="display:flex; gap:5px;">
                            <input type="file" id="file-${p.id}" accept=".json" style="display:none;">
                            <button class="btn-browse-file" data-id="${p.id}" style="background:var(--border-main); color:var(--text-main); border:none; padding:4px 8px; border-radius:3px; font-size:10px; cursor:pointer;">📂 Browse File</button>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <label style="font-size:10px; color:var(--text-muted); margin-bottom:2px;">Raw TS</label>
                        <input type="number" id="raw-${p.id}" placeholder="Auto" value="${savedRaw}" style="width:60px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); padding:5px;">
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <button id="dpw-next" style="background:var(--accent); color:var(--bg-dark); font-weight:bold; padding:10px; border:none; border-radius:4px; cursor:pointer;">Next ➔</button>
        `;
        
        modal.innerHTML = html;

        document.getElementById('dpw-close').onclick = () => overlay.remove();

        // Handle File Browsing
        document.getElementById('dpw-player-list').addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('btn-browse-file')) {
                const pId = e.target.getAttribute('data-id');
                document.getElementById(`file-${pId}`).click();
            }
        });

        // Handle File Reading
        document.getElementById('dpw-player-list').addEventListener('change', (e) => {
            if (e.target && e.target.type === 'file') {
                const file = e.target.files[0];
                if (!file) return;
                
                const pId = e.target.id.replace('file-', '');
                const reader = new FileReader();
                reader.onload = function(event) {
                    document.getElementById(`json-${pId}`).value = event.target.result;
                };
                reader.readAsText(file);
                e.target.value = ''; // Reset input
            }
        });

        document.getElementById('dpw-next').onclick = () => {
            let uniqueUnits = new Set();
            let parsedPlayerTeams = {}; 
            
            for (const p of players) {
                const jsonStr = document.getElementById(`json-${p.id}`).value.trim();
                const rawStr = document.getElementById(`raw-${p.id}`).value.trim();
                
                cache.playerJsons[p.id] = jsonStr;
                
                if (rawStr !== "") {
                    cache.rawTS[p.id] = parseFloat(rawStr);
                    parsedPlayerTeams[p.id] = []; 
                } else if (jsonStr) {
                    delete cache.rawTS[p.id]; 
                    try {
                        const parsed = JSON.parse(jsonStr);
                        let teamUnits = [];
                        if (Array.isArray(parsed)) {
                            parsed.forEach(item => {
                                if (item.m && item.m.typ) {
                                    const baseName = item.m.typ.replace(/\d+$/, '');
                                    teamUnits.push(baseName);
                                    uniqueUnits.add(baseName);
                                }
                            });
                        }
                        parsedPlayerTeams[p.id] = teamUnits;
                    } catch (e) {
                        alert(`Invalid JSON for player: ${p.name}. Please check the formatting.`);
                        return; // Halt execution
                    }
                } else {
                    delete cache.rawTS[p.id];
                    parsedPlayerTeams[p.id] = [];
                }
            }

            renderPage2(Array.from(uniqueUnits).sort(), parsedPlayerTeams);
        };
    }

    // --- RENDER PAGE 2: UNIT VALUES ---
    function renderPage2(uniqueUnits, parsedPlayerTeams) {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0; color:var(--accent);">Assign Unit Strength Values</h2>
                <button id="dpw-back" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:14px;">⬅ Back</button>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:15px; background:rgba(0,0,0,0.3); padding:10px; border-radius:4px; align-items:center;">
                <label style="font-size:12px; color:var(--text-muted);">Set all unset units to:</label>
                <input type="number" id="global-sv" min="0" style="width:80px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); padding:5px;">
                <button id="btn-apply-global" style="background:var(--success); color:var(--bg-dark); border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Apply</button>
            </div>

            <div style="overflow-y:auto; flex-grow:1; margin-bottom:15px; border:1px solid var(--border-main); border-radius:4px; padding:10px;">
        `;

        if (uniqueUnits.length === 0) {
            html += `<p style="text-align:center; color:var(--text-muted);">No units detected. Using Raw TS values.</p>`;
        } else {
            uniqueUnits.forEach(unit => {
                const val = cache.unitSVs[unit] !== undefined ? cache.unitSVs[unit] : "";
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px dashed var(--border-main); padding-bottom:5px;">
                        <span style="font-size:14px; color:var(--text-main);">${unit}</span>
                        <input type="number" step="0.1" min="0" class="sv-input" data-unit="${unit}" value="${val}" style="width:80px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); padding:5px;">
                    </div>
                `;
            });
        }

        html += `
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:var(--text-muted);" title="Desired rating gap between 1st and last place at the end of the tournament">Target Spread (Default 200)</label>
                    <input type="number" id="dpw-spread" value="${existingConfig?.target_spread || 200}" style="width:100%; box-sizing:border-box; padding:5px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main);">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:var(--text-muted);" title="0 = Pure Rating, 1 = Pure Team Score">Beta Weight (Default 0.7)</label>
                    <input type="number" step="0.1" id="dpw-beta" value="${existingConfig?.beta || 0.7}" style="width:100%; box-sizing:border-box; padding:5px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main);">
                </div>
            </div>

            <button id="dpw-save" style="background:var(--accent); color:var(--bg-dark); font-weight:bold; padding:10px; border:none; border-radius:4px; cursor:pointer;">💾 Save Stage Settings</button>
        `;

        modal.innerHTML = html;

        document.getElementById('dpw-back').onclick = renderPage1;

        document.getElementById('btn-apply-global').onclick = () => {
            const val = document.getElementById('global-sv').value;
            if (val === "") return;
            document.querySelectorAll('.sv-input').forEach(input => {
                if (input.value === "") input.value = val;
            });
        };

        document.getElementById('dpw-save').onclick = () => {
            document.querySelectorAll('.sv-input').forEach(input => {
                cache.unitSVs[input.getAttribute('data-unit')] = parseFloat(input.value) || 0;
            });

            let playerTSMap = {};
            players.forEach(p => {
                if (cache.rawTS[p.id] !== undefined) {
                    playerTSMap[p.id] = cache.rawTS[p.id];
                } else {
                    let total = 0;
                    const team = parsedPlayerTeams[p.id] || [];
                    team.forEach(unit => total += (cache.unitSVs[unit] || 0)); 
                    playerTSMap[p.id] = total;
                }
            });

            // 1. Calculate Pairwise C_TS
            const tsValues = Object.values(playerTSMap);
            let sumDiff = 0, pairs = 0;
            for(let i=0; i<tsValues.length; i++) {
                for(let j=i+1; j<tsValues.length; j++) {
                    sumDiff += Math.abs(tsValues[i] - tsValues[j]);
                    pairs++;
                }
            }
            const avgDiff = pairs > 0 ? (sumDiff / pairs) : 0;
            const computed_C_TS = Math.max(4 * avgDiff, 1);

            // 2. Lock in DPW Math Variables (Using user inputs or smart defaults)
            const targetSpread = parseFloat(document.getElementById('dpw-spread').value) || 200;
            const totalRounds = rounds || Math.max(1, Math.ceil(Math.log2(players.length)));
            const auto_r_ramp = Math.max(1, Math.floor(totalRounds / 3));
            const auto_K_base = targetSpread / totalRounds;

            // 3. Save to config
            const finalConfig = {
                type: "dpw_swiss",
                maxRounds: totalRounds,
                cutToTop: cut || undefined,
                target_spread: targetSpread,
                beta: parseFloat(document.getElementById('dpw-beta').value) || 0.7,
                C_TS: computed_C_TS,
                K_base: auto_K_base,
                r_ramp: existingConfig?.r_ramp || auto_r_ramp,
                tiebreakers: existingConfig?.tiebreakers || ["dpw_rating", "head_to_head", "buchholz"], 
                dpwData: cache 
            };

            overlay.remove();
            onComplete(finalConfig, playerTSMap);
        };
    }

    renderPage1();
}

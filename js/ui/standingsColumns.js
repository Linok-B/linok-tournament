import { getIcon } from './icons.js';

// Epsilon Number Sanitizers (Max 4 Decimals cuz I personally do at least that)
export function formatMetricNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const rounded = Math.round((Number(val) + Number.EPSILON) * 10000) / 10000;
    return rounded.toString();
}

export function formatDifferential(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = Math.round((Number(val) + Number.EPSILON) * 10000) / 10000;
    if (num > 0) return `+${num}`;
    return num.toString();
}

// column Registry
export const STANDINGS_COLUMNS = {
    match_points: {
        id: "match_points",
        name: "Match Points",
        getHeaderHTML: () => "Points",
        getValue: (p) => formatMetricNumber(p.stats?.points ?? 0),
        style: "font-weight: bold; color: var(--accent); text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    game_points: {
        id: "game_points",
        name: "Game Points",
        getHeaderHTML: () => "Game Pts",
        getValue: (p) => formatMetricNumber(p.stats?.gamePoints ?? 0),
        style: "font-weight: bold; color: var(--accent); text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    dpw_rating: {
        id: "dpw_rating",
        name: "DPW Rating",
        getHeaderHTML: () => "Rating",
        getValue: (p) => formatMetricNumber(p.stats?.dpwRating ?? 1000),
        style: "font-weight: bold; color: var(--accent); text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    team_score: {
        id: "team_score",
        name: "Team Score (TS)",
        getHeaderHTML: () => "TS",
        getValue: (p) => formatMetricNumber(p.metadata?.dpwTS ?? 0),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    match_record: {
        id: "match_record",
        name: "Match Record (W-L-D)",
        getHeaderHTML: (recFormat) => `Matches<br><span style="font-size: 10px; font-weight: normal; color: var(--text-muted); letter-spacing: 0.5px;">${recFormat.toUpperCase().split('').join('-')}</span>`,
        getValue: (p, recFormat) => {
            const w = p.stats?.matchWins ?? 0;
            const l = p.stats?.matchLosses ?? 0;
            const d = p.stats?.matchDraws ?? 0;
            return recFormat === "wdl" ? `${w}-${d}-${l}` : `${w}-${l}-${d}`;
        },
        style: "text-align: center; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: center;"
    },
    game_record: {
        id: "game_record",
        name: "Game Record (W-L-D)",
        getHeaderHTML: (recFormat) => `Games<br><span style="font-size: 10px; font-weight: normal; color: var(--text-muted); letter-spacing: 0.5px;">${recFormat.toUpperCase().split('').join('-')}</span>`,
        getValue: (p, recFormat) => {
            const w = p.stats?.gameWins ?? 0;
            const l = p.stats?.gameLosses ?? 0;
            const d = p.stats?.gameDraws ?? 0;
            return recFormat === "wdl" ? `${w}-${d}-${l}` : `${w}-${l}-${d}`;
        },
        style: "text-align: center; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: center;"
    },
    match_differential: {
        id: "match_differential",
        name: "Match W-L Differential",
        getHeaderHTML: () => "Match Diff",
        getValue: (p) => formatDifferential((p.stats?.matchWins ?? 0) - (p.stats?.matchLosses ?? 0)),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    game_differential: {
        id: "game_differential",
        name: "Game W-L Differential",
        getHeaderHTML: () => "Game Diff",
        getValue: (p) => formatDifferential((p.stats?.gameWins ?? 0) - (p.stats?.gameLosses ?? 0)),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    buchholz: {
        id: "buchholz",
        name: "Buchholz",
        getHeaderHTML: () => "Buchholz",
        getValue: (p) => formatMetricNumber(p.stats?.buchholz ?? 0),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    median_buchholz: {
        id: "median_buchholz",
        name: "Median Buchholz",
        getHeaderHTML: () => "Med. Buch",
        getValue: (p) => formatMetricNumber(p.stats?.median_buchholz ?? 0),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    elo: {
        id: "elo",
        name: "Starting ELO",
        getHeaderHTML: () => "ELO",
        getValue: (p) => formatMetricNumber(p.elo ?? 1200),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    seed: {
        id: "seed",
        name: "Registration Seed",
        getHeaderHTML: () => "Seed",
        getValue: (p) => (p.originalSeed ?? p.seed ?? '-').toString(),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    }
};

// Map from Rules to Columns
const TB_TO_COLUMN_MAP = {
    "points": "match_points",
    "game_points": "game_points",
    "dpw_rating": "dpw_rating",
    "team_score": "team_score",
    "match_differential": "match_differential",
    "game_differential": "game_differential",
    "head_to_head": "match_record",
    "h2h_game_diff": "game_differential",
    "buchholz": "buchholz",
    "median_buchholz": "median_buchholz",
    "elo": "elo",
    "seed": "seed"
};

// Auto-Resolver with Deduplication and Auto-Fill Toggle
export function resolveStageColumns(stageConfig, tournamentSettings = {}) {
    const isAuto = stageConfig?.autoColumns !== false;
    const shouldAutoFill = stageConfig?.autoFillColumns !== false;
    const recFormat = tournamentSettings?.recordFormat || "wld";
    const maxCols = 5;

    let columnIds = [];

    if (!isAuto) {
        // Manual Selection mode
        columnIds = [...(stageConfig?.customColumns || [])];
    } else {
        // Auto-Order based on active tiebreakers
        const tiebreakers = stageConfig?.tiebreakers || tournamentSettings?.tiebreakers || ["points"];
        const seen = new Set();

        tiebreakers.forEach(tb => {
            const colId = TB_TO_COLUMN_MAP[tb];
            if (colId && STANDINGS_COLUMNS[colId] && !seen.has(colId)) {
                seen.add(colId);
                columnIds.push(colId);
            }
        });

        // Deduplication
        columnIds = Array.from(new Set(columnIds));

        // Auto-fill secondary columns if enabled and under budget
        if (shouldAutoFill && columnIds.length < maxCols) {
            const fillPriority = ["match_record", "game_record", "game_differential", "buchholz"];
            for (let fillId of fillPriority) {
                if (columnIds.length >= maxCols) break;
                if (!seen.has(fillId) && STANDINGS_COLUMNS[fillId]) {
                    seen.add(fillId);
                    columnIds.push(fillId);
                }
            }
        }
    }

    // Limit to 5 max
    columnIds = columnIds.slice(0, maxCols);

    // Map to column definition objects
    return columnIds.map(id => {
        const def = STANDINGS_COLUMNS[id];
        return {
            ...def,
            headerHTML: def.getHeaderHTML(recFormat),
            formatValue: (player) => def.getValue(player, recFormat)
        };
    }).filter(Boolean);
}

// standings Columns Configu Modal for stage Settongs
export function openStandingsColumnsModal(stageConfig, onSave) {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:10002; display:flex; justify-content:center; align-items:center;";

    const modal = document.createElement('div');
    modal.style.cssText = "background:var(--bg-panel); border:2px solid var(--accent); border-radius:8px; width:440px; max-width:92vw; padding:25px; display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box; color:var(--text-main);";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let draftAuto = stageConfig.autoColumns !== false;
    let draftAutoFill = stageConfig.autoFillColumns !== false;
    let draftColumns = stageConfig.customColumns ? [...stageConfig.customColumns] : resolveStageColumns(stageConfig).map(c => c.id);

    function render() {
        const isMax = draftColumns.length >= 5;

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:var(--accent); display:flex; align-items:center; gap:8px;">
                    ${getIcon('gear', 20)} Configure Standings Columns
                </h3>
                <button id="btn-close-col-modal" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:18px;">X</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px;">
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="chk-auto-cols" ${draftAuto ? 'checked' : ''}>
                    <span>Auto-order columns by active tiebreakers</span>
                </label>

                <label class="custom-checkbox-label">
                    <input type="checkbox" id="chk-autofill-cols" ${draftAutoFill ? 'checked' : ''}>
                    <span>Auto-fill remaining slots (up to 5 columns)</span>
                </label>
            </div>

            <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; display:flex; justify-content:space-between;">
                <span>Active Columns (${draftColumns.length}/5)</span>
                ${draftAuto ? '<span style="color:var(--accent); font-weight:bold;">(Auto-Controlled)</span>' : ''}
            </div>

            <!-- Columns List -->
            <div id="col-active-list" style="display:flex; flex-direction:column; gap:6px; background:var(--bg-dark); padding:10px; border-radius:4px; min-height:80px; max-height:220px; overflow-y:auto; border:1px solid var(--border-main); margin-bottom:15px; ${draftAuto ? 'opacity:0.6;' : ''}">
                ${draftColumns.length === 0 ? `
                    <div style="text-align:center; color:var(--text-muted); font-size:12px; padding:15px;">
                        No data columns selected. Standings will display Rank & Name only.
                    </div>
                ` : draftColumns.map((colId, index) => {
                    const col = STANDINGS_COLUMNS[colId];
                    if (!col) return '';
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); padding:6px 10px; border-radius:4px; border:1px solid var(--border-main);">
                            <span style="font-size:12px; color:var(--text-main); font-weight:bold;">${index + 1}. ${col.name}</span>
                            <div style="display:flex; gap:4px;">
                                <button class="btn-col-up" data-index="${index}" ${draftAuto || index === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↑</button>
                                <button class="btn-col-down" data-index="${index}" ${draftAuto || index === draftColumns.length - 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↓</button>
                                <button class="btn-col-del" data-index="${index}" ${draftAuto ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="color:var(--danger); cursor:pointer;"'}>X</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Add Column Dropdown -->
            <div style="display:flex; gap:6px; margin-bottom:15px;">
                <select id="sel-add-col" ${draftAuto || isMax ? 'disabled' : ''} style="flex-grow:1; padding:6px; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-main); border-radius:4px; ${draftAuto || isMax ? 'opacity:0.5; cursor:not-allowed;' : ''}">
                    ${Object.values(STANDINGS_COLUMNS).map(col => {
                        const alreadyAdded = draftColumns.includes(col.id);
                        return `<option value="${col.id}" ${alreadyAdded ? 'disabled' : ''}>${col.name} ${alreadyAdded ? '(Added)' : ''}</option>`;
                    }).join('')}
                </select>
                <button id="btn-add-col" ${draftAuto || isMax ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background:var(--success); color:var(--text-on-accent); border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">
                    + Add
                </button>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-main); padding-top:15px;">
                <button id="btn-col-cancel" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-main); padding:8px 16px; border-radius:4px; cursor:pointer;">Cancel</button>
                <button id="btn-col-save" style="background:var(--accent); color:var(--text-on-accent); padding:8px 20px; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">Save Columns</button>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.getElementById('btn-close-col-modal').onclick = () => overlay.remove();
        document.getElementById('btn-col-cancel').onclick = () => overlay.remove();

        document.getElementById('chk-auto-cols').onchange = (e) => {
            draftAuto = e.target.checked;
            if (draftAuto) {
                draftColumns = resolveStageColumns({ ...stageConfig, autoColumns: true, autoFillColumns: draftAutoFill }).map(c => c.id);
            }
            render();
        };

        document.getElementById('chk-autofill-cols').onchange = (e) => {
            draftAutoFill = e.target.checked;
            if (draftAuto) {
                draftColumns = resolveStageColumns({ ...stageConfig, autoColumns: true, autoFillColumns: draftAutoFill }).map(c => c.id);
            }
            render();
        };

        document.getElementById('btn-add-col').onclick = () => {
            if (draftAuto || draftColumns.length >= 5) return;
            const sel = document.getElementById('sel-add-col');
            const val = sel.value;
            if (val && !draftColumns.includes(val)) {
                draftColumns.push(val);
                render();
            }
        };

        document.getElementById('col-active-list').onclick = (e) => {
            if (draftAuto || e.target.tagName !== 'BUTTON') return;
            const idx = parseInt(e.target.getAttribute('data-index'));

            if (e.target.classList.contains('btn-col-del')) {
                draftColumns.splice(idx, 1);
            } else if (e.target.classList.contains('btn-col-up') && idx > 0) {
                [draftColumns[idx - 1], draftColumns[idx]] = [draftColumns[idx], draftColumns[idx - 1]];
            } else if (e.target.classList.contains('btn-col-down') && idx < draftColumns.length - 1) {
                [draftColumns[idx + 1], draftColumns[idx]] = [draftColumns[idx], draftColumns[idx + 1]];
            }
            render();
        };

        document.getElementById('btn-col-save').onclick = () => {
            stageConfig.autoColumns = draftAuto;
            stageConfig.autoFillColumns = draftAutoFill;
            stageConfig.customColumns = draftColumns;

            overlay.remove();
            if (typeof onSave === 'function') onSave();
        };
    }

    render();
}

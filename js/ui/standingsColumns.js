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

// Approximate rendered widths of the 10px header labels (Note: might need tweaking if font differs, or something else billshits)
const LABEL_PX = { W: 9, D: 7, L: 5.5 };

const PAD = 'calc(0.5ch + 1px)';
const HDR_VAL = 'font-size: 10px; color: var(--text-muted); font-weight: normal;';
const HDR_HYPHEN = 'font-size: 10px; font-weight: normal;';

export function renderRecord(v1, v2, v3, w1, w2, w3, isHeader = false) {
    const vals = [v1, v2, v3];
    const widths = [w1, w2, w3];

    // Free space (inside the column, excluding padding) on each side of a centered value, as a CSS length. digits are 1ch each. Header gas fixed label px width.
    const slack = (i) => isHeader
        ? `(${widths[i]}ch - ${LABEL_PX[vals[i]] ?? 6}px)`
        : `${widths[i] - String(vals[i]).length}ch`;

    // Boundary between column i and i+1 = sum of full column widths so far
    // Each column is width + 1ch + 2px (half-digit padding + 1px, on both sides).
    const boundary = (i) => {
        let ch = 0;
        for (let k = 0; k <= i; k++) ch += widths[k] + 1;
        return `${ch}ch + ${(i + 1) * 2}px`;
    };

    // Midpoint between the right edge of the left value and the left edge of the right value
    const hyphenLeft = (i) =>
        `calc(${boundary(i)} + (${slack(i + 1)} - ${slack(i)}) / 4)`;

    const valStyle = isHeader ? HDR_VAL : '';
    const hyphenStyle = isHeader ? HDR_HYPHEN : '';

    const cols = vals.map((v, i) =>
        `<span style="display:inline-block; box-sizing:content-box; width:${widths[i]}ch; padding:0 ${PAD}; text-align:center;"><span style="${valStyle}">${v}</span></span>`
    ).join('');

    const hyphens = [0, 1].map(i =>
        `<span style="position:absolute; top:0; bottom:0; left:${hyphenLeft(i)}; transform:translateX(-50%); display:flex; align-items:center; pointer-events:none; color:var(--text-muted); ${hyphenStyle}">-</span>`
    ).join('');

    return `<div style="position:relative; display:inline-flex; align-items:center; vertical-align:top; font-variant-numeric:tabular-nums;">${cols}${hyphens}</div>`;
}

// Scans maximum digits per column
function getSlotWidths(players, isGames = false) {
    let maxW = 0, maxL = 0, maxD = 0;

    for (let i = 0; i < players.length; i++) {
        const s = players[i].stats;
        if (!s) continue;
        const w = isGames ? (s.gameWins ?? 0) : (s.matchWins ?? 0);
        const l = isGames ? (s.gameLosses ?? 0) : (s.matchLosses ?? 0);
        const d = isGames ? (s.gameDraws ?? 0) : (s.matchDraws ?? 0);

        if (w > maxW) maxW = w;
        if (l > maxL) maxL = l;
        if (d > maxD) maxD = d;
    }

    const digitsW = maxW > 0 ? maxW.toString().length : 1;
    const digitsL = maxL > 0 ? maxL.toString().length : 1;
    const digitsD = maxD > 0 ? maxD.toString().length : 1;

    return {
        w: digitsW,
        l: digitsL,
        d: digitsD
    };
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
        name: "Team Score",
        getHeaderHTML: () => "TS",
        getValue: (p) => formatMetricNumber(p.metadata?.dpwTS ?? 0),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    match_record: {
        id: "match_record",
        name: "Match Record",
        getHeaderHTML: (recFormat, widths = { w: 1, l: 1, d: 1 }) => {
            const [w1, w2, w3] = recFormat === "wdl" ? [widths.w, widths.d, widths.l] : [widths.w, widths.l, widths.d];
            const [l1, l2, l3] = recFormat === "wdl" ? ["W", "D", "L"] : ["W", "L", "D"];
            return `Matches<br>${renderRecord(l1, l2, l3, w1, w2, w3, true)}`;
        },
        getValue: (p, recFormat, widths = { w: 1, l: 1, d: 1 }) => {
            const w = p.stats?.matchWins ?? 0;
            const l = p.stats?.matchLosses ?? 0;
            const d = p.stats?.matchDraws ?? 0;
            const [w1, w2, w3] = recFormat === "wdl" ? [widths.w, widths.d, widths.l] : [widths.w, widths.l, widths.d];
            const [v1, v2, v3] = recFormat === "wdl" ? [w, d, l] : [w, l, d];
            return renderRecord(v1, v2, v3, w1, w2, w3, false);
        },
        style: "text-align: left; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: left; font-variant-numeric: tabular-nums;"
    },
    game_record: {
        id: "game_record",
        name: "Game Record",
        getHeaderHTML: (recFormat, widths = { w: 1, l: 1, d: 1 }) => {
            const [w1, w2, w3] = recFormat === "wdl" ? [widths.w, widths.d, widths.l] : [widths.w, widths.l, widths.d];
            const [l1, l2, l3] = recFormat === "wdl" ? ["W", "D", "L"] : ["W", "L", "D"];
            return `Games<br>${renderRecord(l1, l2, l3, w1, w2, w3, true)}`;
        },
        getValue: (p, recFormat, widths = { w: 1, l: 1, d: 1 }) => {
            const w = p.stats?.gameWins ?? 0;
            const l = p.stats?.gameLosses ?? 0;
            const d = p.stats?.gameDraws ?? 0;
            const [w1, w2, w3] = recFormat === "wdl" ? [widths.w, widths.d, widths.l] : [widths.w, widths.l, widths.d];
            const [v1, v2, v3] = recFormat === "wdl" ? [w, d, l] : [w, l, d];
            return renderRecord(v1, v2, v3, w1, w2, w3, false);
        },
        style: "text-align: left; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: left; font-variant-numeric: tabular-nums;"
    },
    match_differential: {
        id: "match_differential",
        name: "Match Differential",
        getHeaderHTML: () => "Match Diff",
        getValue: (p) => formatDifferential((p.stats?.matchWins ?? 0) - (p.stats?.matchLosses ?? 0)),
        style: "text-align: right; font-variant-numeric: tabular-nums;",
        headerStyle: "text-align: right;"
    },
    game_differential: {
        id: "game_differential",
        name: "Game Differential",
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
export function resolveStageColumns(stageConfig, tournamentSettings = {}, players = []) {
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
            let colId = TB_TO_COLUMN_MAP[tb];
            // Backwards compatibility for older stages set to display Game Points
            if (tb === "points" && stageConfig?.pointsColumnDisplay === "game_points") {
                colId = "game_points";
            }

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

    // scan players only if column is actually being used
    const needsMatchWidths = columnIds.includes("match_record");
    const needsGameWidths = columnIds.includes("game_record");

    const matchWidths = (needsMatchWidths && players.length > 0) ? getSlotWidths(players, false) : { w: 1, l: 1, d: 1 };
    const gameWidths = (needsGameWidths && players.length > 0) ? getSlotWidths(players, true) : { w: 1, l: 1, d: 1 };

    // Map to column definition objects
    return columnIds.map(id => {
        const def = STANDINGS_COLUMNS[id];
        const widths = id === "game_record" ? gameWidths : matchWidths;

        return {
            ...def,
            headerHTML: def.getHeaderHTML(recFormat, widths),
            formatValue: (player) => def.getValue(player, recFormat, widths)
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
                    <span>Auto-fill remaining slots</span>
                </label>
            </div>

            <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">
                Active Columns (${draftColumns.length}/5)
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
                                <button class="btn-col-del" data-index="${index}" ${draftAuto ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>X</button>
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
                        return `<option value="${col.id}" ${alreadyAdded ? 'disabled' : ''}>${col.name}${alreadyAdded ? ' — Added' : ''}</option>`;
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

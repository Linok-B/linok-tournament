import { getIcon } from './icons.js';

export const TB_NAMES = {
    "placement": "Tournament Placement",
    "points": "Match Points", 
    "game_points": "Game Points", 
    "dpw_rating": "DPW Rating", 
    "team_score": "Team Score (TS)", 
    "match_differential": "Match W-L Differential",
    "game_differential": "Game W-L Differential",
    "head_to_head": "Head-to-Head", 
    "h2h_game_diff": "H2H Game Differential",
    "buchholz": "Buchholz", 
    "median_buchholz": "Median Buchholz",
    "elo": "Starting ELO", 
    "seed": "Registration Seed"
};

export const TB_DEFAULTS = {
    "single_elimination": ["placement", "seed"],
    "double_elimination": ["placement", "seed"],
    "round_robin": ["points", "game_differential", "head_to_head", "seed"],
    "swiss": ["points", "buchholz", "game_differential", "head_to_head", "seed"],
    "dpw_swiss": ["dpw_rating", "team_score", "head_to_head", "buchholz", "seed"]
};

let pendingTiebreakers = [];

function updateTBButtonLabel() {
    const tbBtn = document.getElementById('btn-open-tb-builder');
    if (tbBtn) {
        tbBtn.innerHTML = `<span data-icon="scale" data-size="16"></span> Tiebreakers: ${pendingTiebreakers.length} Rules`;
        const span = tbBtn.querySelector('span');
        if (span) span.innerHTML = getIcon('scale', 16);
    }
}

export function getPendingTiebreakers() {
    return [...pendingTiebreakers];
}

export function setPendingForFormat(format) {
    pendingTiebreakers = [...(TB_DEFAULTS[format] || ["points"])];
    updateTBButtonLabel();
}

function renderTBList(targetArray) {
    const list = document.getElementById('tb-active-list');
    if (!list) return;
    list.innerHTML = '';
    const bpType = document.getElementById('blueprint-type');
    const isDPW = bpType ? bpType.value === "dpw_swiss" : false;

    targetArray.forEach((rule, index) => {
        const isLocked = isDPW && rule === "dpw_rating";
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); padding:5px 10px; border:1px solid var(--border-main); border-radius:4px;">
                <span style="font-size:13px; color:${isLocked ? 'var(--warning)' : 'var(--text-main)'}"><b>${index + 1}.</b> ${TB_NAMES[rule] || rule} ${isLocked ? '(Locked)' : ''}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-tb-up" data-index="${index}" ${index === 0 || isLocked || (index===1 && targetArray[0]==="dpw_rating" && isDPW) ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↑</button>
                    <button class="btn-tb-down" data-index="${index}" ${index === targetArray.length - 1 || isLocked ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : 'style="cursor:pointer;"'}>↓</button>
                    <button class="btn-tb-remove" data-index="${index}" ${isLocked ? 'disabled style="opacity:0.3; cursor:not-allowed; color:var(--text-muted);"' : 'style="color:var(--danger); cursor:pointer;"'}>X</button>
                </div>
            </div>
        `;
    });
}


function injectTiebreakerModalHTML() {
    if (document.getElementById('tiebreaker-modal')) return;

    const html = `
    <!-- TIEBREAKER BUILDER MODAL -->
    <div id="tiebreaker-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center;">
        <div style="background: var(--bg-panel); padding: 20px; border-radius: 8px; width: 400px; border: 2px solid var(--accent);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-main); padding-bottom: 10px; margin-bottom: 15px;">
                <h2 style="margin: 0; color: var(--accent); display:flex; align-items:center; gap:8px;">${getIcon('scale', 24)} Tiebreaker Builder</h2>
                <button id="btn-close-tb-builder" style="background: transparent; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; font-weight: bold;">X</button>
            </div>
            
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 0;">Rules evaluate from top to bottom. If players remain tied after all rules, they will share a rank.</p>
            
            <div id="tb-active-list" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; min-height: 100px;">
                <!-- Filled by JS -->
            </div>

            <div style="display: flex; gap: 5px; margin-bottom: 15px;">
                <select id="tb-add-select" style="flex-grow: 1; padding: 5px; background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-main);">
                    <option value="placement">Tournament Placement (Elimination)</option>
                    <option value="points">Match Points</option>
                    <option value="game_points">Game Points</option>
                    <option value="dpw_rating">DPW Rating</option>
                    <option value="team_score">Team Score (DPW TS)</option>
                    <option value="match_differential">Match W-L Differential</option>
                    <option value="game_differential">Game W-L Differential</option>
                    <option value="head_to_head">Head-to-Head</option>
                    <option value="h2h_game_diff">H2H Game Differential</option>
                    <option value="buchholz">Buchholz (Schedule Strength)</option>
                    <option value="median_buchholz">Median Buchholz</option>
                    <option value="elo">Starting ELO / Rating</option>
                    <option value="seed">Registration Seed</option>
                </select>
                <button id="btn-tb-add" style="background: var(--success); color: var(--bg-dark); border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer; font-weight: bold;">+ Add</button>
            </div>

            <button id="btn-save-tb" style="width: 100%; background: var(--accent); color: var(--bg-dark); font-weight: bold; padding: 10px; border-radius: 4px; border: none; cursor: pointer;">Save Tiebreakers</button>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
}

export function initTiebreakerModal() {
    injectTiebreakerModalHTML();
    const tbModal = document.getElementById('tiebreaker-modal');
    const bpSelect = document.getElementById('blueprint-type');

    // Init state dynamically based on what the browser cached in the dropdown
    const initialFormat = bpSelect ? bpSelect.value : "single_elimination";
    setPendingForFormat(initialFormat);

    // Format dropdown change listener
    if (bpSelect) {
        bpSelect.addEventListener('change', (e) => {
            setPendingForFormat(e.target.value);
        });
    }

    // Open Modal
    document.getElementById('btn-open-tb-builder').addEventListener('click', () => {
        const targetArray = window.activeEditTiebreakersTarget || pendingTiebreakers;
        window.tempEditArray = targetArray;
        renderTBList(targetArray);
        tbModal.style.display = 'flex';
    });

    // Close Modal
    document.getElementById('btn-close-tb-builder').addEventListener('click', () => {
        window.activeEditTiebreakersTarget = null;
        window.activeEditTiebreakersCallback = null;
        tbModal.style.display = 'none';
    });

    // Save Modal
    document.getElementById('btn-save-tb').addEventListener('click', () => {
        if (window.activeEditTiebreakersCallback) {
            window.activeEditTiebreakersCallback(window.tempEditArray);
            window.activeEditTiebreakersTarget = null;
            window.activeEditTiebreakersCallback = null;
        } else {
            pendingTiebreakers = window.tempEditArray;
            updateTBButtonLabel();
        }
        tbModal.style.display = 'none';
    });

    // Add a rule
    document.getElementById('btn-tb-add').addEventListener('click', () => {
        const rule = document.getElementById('tb-add-select').value;
        const targetArray = window.tempEditArray || pendingTiebreakers;
        if (targetArray.includes(rule)) {
            alert("Rule already active!");
            return;
        }
        targetArray.push(rule);
        renderTBList(targetArray);
    });

    // Move / Remove rules
    document.getElementById('tb-active-list').addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const index = parseInt(e.target.getAttribute('data-index'));
        const targetArray = window.tempEditArray || pendingTiebreakers;
        
        if (e.target.classList.contains('btn-tb-remove')) {
            targetArray.splice(index, 1);
        } else if (e.target.classList.contains('btn-tb-up')) {
            [targetArray[index - 1], targetArray[index]] = [targetArray[index], targetArray[index - 1]];
        } else if (e.target.classList.contains('btn-tb-down')) {
            [targetArray[index + 1], targetArray[index]] = [targetArray[index], targetArray[index + 1]];
        }
        
        renderTBList(targetArray);
    });
}

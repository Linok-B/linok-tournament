import { calculateTiebreakers } from '../engine/systems/tiebreakers.js';

export function renderPlayerList(players, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 
    if (players.length === 0) return;

    // Sort by seed by default now, instead of ELO
    const sortedPlayers = [...players].sort((a, b) => a.seed - b.seed);
    
    sortedPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.alignItems = 'center'; // Keep things vertically centered
        
        card.innerHTML = `
            <div>
                <strong>${player.name}</strong>
                <span style="font-size: 12px; color: gray; margin-left: 10px;">
                    Seed: ${player.seed} | ELO: ${player.elo}
                </span>
            </div>
            <button class="btn-remove-player" data-id="${player.id}" 
                style="background-color: var(--danger); padding: 4px 10px; border-radius: 4px;">
                X
            </button>
        `;
        container.appendChild(card);
    });
}

export function renderBracket(tournament, containerId) {
    const container = document.getElementById(containerId);
    
    if (tournament.status === "setup" || tournament.stages.length === 0) {
        container.innerHTML = `
            <h2>Setup: Add Players</h2>
            <p>Total: ${tournament.players.length}</p>
            <div id="players-list"></div>
        `;
        renderPlayerList(tournament.players, 'players-list');
        return;
    }

    // NEW: Allow the UI to view a past stage if requested, otherwise default to the active/last stage
    // (w/ a global variable 'window.viewingStageIndex' to track which tab is clicked)
    let viewIndex = window.viewingStageIndex !== undefined ? window.viewingStageIndex : tournament.stages.length - 1;
    
    // Failsafe bounds check
    if (viewIndex < 0) viewIndex = 0;
    if (viewIndex >= tournament.stages.length) viewIndex = tournament.stages.length - 1;

    const stageToRender = tournament.stages[viewIndex];
    const isActiveStage = (viewIndex === tournament.stages.length - 1 && tournament.status !== "completed");
    
    // BUILD THE TABS
    let tabsHtml = `<div style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 2px solid #45475a; padding-bottom: 10px;">`;
    tournament.stages.forEach((stage, index) => {
        const isSelected = index === viewIndex;
        tabsHtml += `
            <button class="btn-stage-tab" data-index="${index}" 
                style="
                    background: ${isSelected ? 'var(--accent)' : 'transparent'}; 
                    color: ${isSelected ? 'var(--bg-dark)' : 'var(--text-main)'}; 
                    border: 1px solid var(--accent); 
                    padding: 5px 15px; 
                    cursor: pointer;
                    font-weight: bold;
                ">
                Stage ${index + 1}: ${stage.config.type.replace('_', ' ').toUpperCase()}
            </button>
        `;
    });
    tabsHtml += `</div>`;
    
    // RENDER THE SELECTED STAGE
    let html = `
        <div style="padding: 0 20px;">
            ${tabsHtml}
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Stage ${stageToRender.stageNumber}: ${stageToRender.config.type.replace('_', ' ').toUpperCase()} 
                    ${stageToRender.status === "completed" ? '<span style="color: gray; font-size: 14px;">(Completed)</span>' : ''}
                </h2>
                ${isActiveStage ? `<button id="btn-force-end-stage" style="background: var(--danger); color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">⏹ Force End Stage Early</button>` : ''}
            </div>
            ${tournament.status === "completed" && isActiveStage ? '<h3 style="color:#a6e3a1;">Tournament Complete!</h3>' : ''}
        </div>
        
        <!-- THE PAN & ZOOM VIEWPORT -->
        <div id="bracket-viewport" style="width: 100%; height: 70vh; overflow: hidden; background: #181825; border-top: 2px solid #45475a; border-bottom: 2px solid #45475a; position: relative; cursor: grab;">
            <div id="bracket-board" style="display:flex; gap:40px; padding: 40px; height: 100%; box-sizing: border-box; transform-origin: 0 0;"></div>
        </div>
    `;

    container.innerHTML = html;
    const board = document.getElementById('bracket-board');

    // DRAW THE ROUNDS
    stageToRender.data.rounds.forEach((roundMatches, roundIndex) => {
        const roundColumn = document.createElement('div');
        roundColumn.className = 'bracket-column'; // Uses the new CSS!
        
        // Add round header inside the column
        const header = document.createElement('h3');
        header.innerText = `Round ${roundIndex + 1}`;
        header.style.textAlign = 'center';
        header.style.position = 'absolute'; // Keep it at the top, separate from flex layout
        header.style.top = '-30px';
        header.style.width = '250px';
        roundColumn.style.position = 'relative';
        roundColumn.appendChild(header);

        roundMatches.forEach(match => {
            const matchBox = document.createElement('div');
            matchBox.className = 'match-box'; // Uses the new CSS!
            
            if (match.winner) matchBox.style.borderLeft = '4px solid #a6e3a1'; 
            else matchBox.style.borderLeft = '4px solid #f38ba8'; 

            const p1Name = match.player1 ? match.player1.name : "TBD";
            const p2Name = match.player2 ? match.player2.name : "TBD";

            if (match.winner || match.isBye) {
                let p1Display = p1Name; let p2Display = p2Name;
                if (match.winner === match.player1 || match.winner === "tie") p1Display = `<strong>${p1Name}</strong>`;
                if (match.winner === match.player2 || match.winner === "tie") p2Display = `<strong>${p2Name}</strong>`;

                matchBox.innerHTML = `
                    <div style="${match.winner === match.player1 ? 'color:#a6e3a1;' : ''}">${p1Display} ${match.winner ? `(${match.score1})` : ''}</div>
                    <div style="${match.winner === match.player2 ? 'color:#a6e3a1;' : ''}">${p2Display} ${match.winner ? `(${match.score2})` : ''}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <small style="color:gray;">${match.isBye ? 'Auto-Advance' : (match.winner === "tie" ? 'TIE' : 'Completed')}</small>
                        ${!match.isBye ? `<button class="btn-edit-match" data-matchid="${match.id}" style="padding:2px 8px; font-size:10px; background:#f9e2af; color:#1e1e2e; border:none; border-radius:3px; cursor:pointer;">Edit</button>` : ''}
                    </div>
                `;
            } else {
                if (isActiveStage) {
                    matchBox.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span>${p1Name}</span>
                            <input type="number" id="s1-${match.id}" style="width:40px; padding:2px; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="0">
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <span>${p2Name}</span>
                            <input type="number" id="s2-${match.id}" style="width:40px; padding:2px; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="0">
                        </div>
                        <button class="btn-report" data-matchid="${match.id}" style="width:100%; padding:5px; font-size:12px; cursor:pointer; background:var(--accent); border:none; border-radius:3px; font-weight:bold;">Submit</button>
                    `;
                } else {
                     matchBox.innerHTML = `<div>${p1Name}</div><div>${p2Name}</div><small style="color:gray;">Pending</small>`;
                }
            }
            roundColumn.appendChild(matchBox);
        });
        board.appendChild(roundColumn);
    });

    // --- NEW: THE PAN & ZOOM ENGINE ---
    applyPanAndZoom(document.getElementById('bracket-viewport'), board);
}

// THE MATH BEHIND PANNING AND ZOOMING
function applyPanAndZoom(viewport, board) {
    let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;

    function setTransform() {
        board.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }

    viewport.addEventListener('mousedown', (e) => {
        // Don't pan if they are clicking a button or typing a score!
        if (['INPUT', 'BUTTON'].includes(e.target.tagName)) return; 
        e.preventDefault();
        panning = true;
        viewport.style.cursor = 'grabbing';
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!panning) return;
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        setTransform();
    });

    window.addEventListener('mouseup', () => {
        panning = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent scrolling the whole page
        
        // Calculate mouse position relative to the zoom
        let xs = (e.clientX - pointX) / scale;
        let ys = (e.clientY - pointY) / scale;
        
        // Zoom in or out
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        scale += delta;
        
        // Clamp scale between 0.3x (zoomed out) and 2x (zoomed in)
        scale = Math.min(Math.max(0.3, scale), 2);
        
        // Re-center around mouse cursor
        pointX = e.clientX - xs * scale;
        pointY = e.clientY - ys * scale;
        
        setTransform();
    }, { passive: false });
}

export function renderStandings(tournament, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. WHICH STAGE ARE WE LOOKING AT?
    let viewIndex = window.viewingStageIndex !== undefined ? window.viewingStageIndex : tournament.stages.length - 1;
    if (viewIndex < 0) viewIndex = 0;
    
    // 2. GET THE TIEBREAKERS FOR THIS SPECIFIC STAGE
    let stageTiebreakers = tournament.settings.tiebreakers; 
    
    if (tournament.stages.length > 0 && tournament.stages[viewIndex].config.tiebreakers) {
        stageTiebreakers = tournament.stages[viewIndex].config.tiebreakers;
    }

    // 3. SYNCHRONOUS MATH ENGINE
    const sortFunction = calculateTiebreakers(tournament.players, tournament.stages);
    const sortedPlayers = [...tournament.players].sort((a, b) => sortFunction(a, b, stageTiebreakers));

    // 4. DRAW THE HTML TABLE
    let html = `
        <h2 style="margin-top: 40px; border-top: 1px solid #45475a; padding-top: 20px;">Current Standings</h2>
        <table style="width: 100%; border-collapse: collapse; text-align: left; background: var(--bg-panel);">
            <thead>
                <tr style="border-bottom: 2px solid var(--accent);">
                    <th style="padding: 10px;">Rank</th>
                    <th style="padding: 10px;">Name</th>
                    <th style="padding: 10px;">Points</th>
                    <th style="padding: 10px;">W-L-D</th>
                    <th style="padding: 10px;">Games (W-L)</th>
                    <th style="padding: 10px;" title="Buchholz (Sum of opponents' points)">Buchholz</th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedPlayers.forEach((player, index) => {
        const pts = player.stats?.points ?? 0;
        const mw = player.stats?.matchWins ?? 0;
        const ml = player.stats?.matchLosses ?? 0;
        const md = player.stats?.matchDraws ?? 0;
        const gw = player.stats?.gameWins ?? 0;
        const gl = player.stats?.gameLosses ?? 0;
        const buch = player.stats?.buchholz ?? 0; // Grab the newly calculated Buchholz score!

        html += `
            <tr style="border-bottom: 1px solid #45475a;">
                <td style="padding: 10px;"><b>${index + 1}</b></td>
                <td style="padding: 10px;">${player.name}</td>
                <td style="padding: 10px; font-weight: bold; color: var(--accent);">${pts}</td>
                <td style="padding: 10px;">${mw} - ${ml} - ${md}</td>
                <td style="padding: 10px;">${gw} - ${gl}</td>
                <td style="padding: 10px;">${buch}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

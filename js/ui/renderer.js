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
        container.innerHTML = `<h2>Setup: Add Players</h2><p>Total: ${tournament.players.length}</p><div id="players-list"></div>`;
        import('./renderer.js').then(m => m.renderPlayerList(tournament.players, 'players-list'));
        return;
    }

    let viewIndex = window.viewingStageIndex !== undefined ? window.viewingStageIndex : tournament.stages.length - 1;
    if (viewIndex < 0) viewIndex = 0;
    if (viewIndex >= tournament.stages.length) viewIndex = tournament.stages.length - 1;

    const stageToRender = tournament.stages[viewIndex];
    const isActiveStage = (viewIndex === tournament.stages.length - 1 && tournament.status !== "completed");
    
    let tabsHtml = `<div class="stage-tabs-container" style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 2px solid #45475a; padding-bottom: 10px;">`;
    tournament.stages.forEach((stage, index) => {
        const isSelected = index === viewIndex;
        tabsHtml += `<button class="btn-stage-tab" data-index="${index}" style="background: ${isSelected ? 'var(--accent)' : 'transparent'}; color: ${isSelected ? 'var(--bg-dark)' : 'var(--text-main)'}; border: 1px solid var(--accent); padding: 5px 15px; cursor: pointer; font-weight: bold;">Stage ${index + 1}: ${stage.config.type.replace('_', ' ').toUpperCase()}</button>`;
    });
    tabsHtml += `</div>`;

    let html = `
        ${tabsHtml}
        <div class="stage-header-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2>Stage ${stageToRender.stageNumber}: ${stageToRender.config.type.replace('_', ' ').toUpperCase()} ${stageToRender.status === "completed" ? '<span style="color: gray; font-size: 14px;">(Completed)</span>' : ''}</h2>
            ${isActiveStage ? `<button id="btn-force-end-stage" style="background: var(--danger); color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">⏹ Force End Stage Early</button>` : ''}
        </div>
        
        <!-- THE NEW VIEWPORT (With the Eye Button inside!) -->
        <div id="bracket-viewport" style="width: 100%; height: 70vh; overflow: hidden; background: #1e1e2e; border: 2px solid #45475a; border-radius: 8px; position: relative; cursor: grab;">
            
            <button id="btn-streamer-mode" style="position: absolute; top: 10px; right: 10px; z-index: 100; background: rgba(0,0,0,0.5); color: white; border: 1px solid #45475a; padding: 5px 10px; border-radius: 4px; cursor: pointer;">👁️ Stream Mode</button>
            
            <!-- We will draw the boxes and lines inside this board -->
            <div id="bracket-board" style="position: absolute; top: 0; left: 0; width: 10000px; height: 10000px; transform-origin: 0 0;">
                <svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // --- THE MATH ENGINE FOR DRAWING THE BRACKET ---
    drawBracketMath(stageToRender, isActiveStage);
}

// ---------------------------------------------------------
// THE ABSOLUTE POSITIONING MATH ENGINE (Draws Boxes & SVG Lines, that's it)
// ---------------------------------------------------------

function drawBracketMath(stage, isActiveStage) {
    const board = document.getElementById('bracket-board');
    // Clear existing SVG and Boxes before redrawing
    board.innerHTML = '<svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>';
    const svgLayer = document.getElementById('bracket-lines');
    
    // Config values for spacing
    const boxWidth = 250; // WIDENED to fit the Submit button!
    const boxHeight = 85;
    const gapX = 60;  
    const gapY = 30;  
    const startX = 50; 
    const startY = 60; // Pushed down slightly to clear the Round Header

    const matchCoordinates = {}; 

    // Loop through columns (Rounds)
    stage.data.rounds.forEach((roundMatches, roundIndex) => {
        const currentX = startX + (roundIndex * (boxWidth + gapX));

        // Draw "Round N" header
        const header = document.createElement('h3');
        header.innerText = `Round ${roundIndex + 1}`;
        header.style.position = 'absolute';
        header.style.left = `${currentX}px`;
        header.style.top = `10px`;
        header.style.width = `${boxWidth}px`;
        header.style.textAlign = 'center';
        header.style.margin = '0';
        board.appendChild(header);

        roundMatches.forEach((match, matchIndex) => {
            let currentY = 0;

            if (stage.config.type === "single_elimination" && roundIndex > 0) {
                // Find parents exactly
                const prevRound = stage.data.rounds[roundIndex - 1];
                const parent1 = prevRound[matchIndex * 2];
                const parent2 = prevRound[(matchIndex * 2) + 1];
                
                const p1Y = parent1 ? matchCoordinates[parent1.id]?.y : 0;
                // If there's no parent 2 (because of odd numbers/byes), just align with parent 1
                const p2Y = parent2 ? matchCoordinates[parent2.id]?.y : p1Y; 

                // Place child perfectly in the middle!
                currentY = (p1Y + p2Y) / 2;

                // DRAW SVG LINES!
                if (parent1 && parent2 && p1Y !== p2Y) {
                    const lineStartX = currentX - gapX;
                    const lineEndX = currentX;
                    
                    // Top line
                    svgLayer.innerHTML += `<path d="M ${lineStartX + boxWidth} ${p1Y + (boxHeight/2)} L ${lineStartX + boxWidth + (gapX/2)} ${p1Y + (boxHeight/2)} L ${lineStartX + boxWidth + (gapX/2)} ${currentY + (boxHeight/2)} L ${lineEndX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    // Bottom line
                    svgLayer.innerHTML += `<path d="M ${lineStartX + boxWidth} ${p2Y + (boxHeight/2)} L ${lineStartX + boxWidth + (gapX/2)} ${p2Y + (boxHeight/2)} L ${lineStartX + boxWidth + (gapX/2)} ${currentY + (boxHeight/2)} L ${lineEndX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                } else if (parent1 && (!parent2 || p1Y === p2Y)) {
                    // Straight line if only one parent
                    const lineStartX = currentX - gapX;
                    svgLayer.innerHTML += `<path d="M ${lineStartX + boxWidth} ${p1Y + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                }

            } else {
                // NON-ELIM FORMATS: Stack them with expanding gaps so Swiss doesn't squish later!
                const multiplier = Math.pow(2, roundIndex); 
                currentY = startY + (matchIndex * (boxHeight + gapY) * multiplier);
            }

            // Save coords BEFORE drawing the HTML box!
            matchCoordinates[match.id] = { x: currentX, y: currentY };

            // BUILD THE BOX HTML
            const matchBox = document.createElement('div');
            matchBox.className = 'match-box';
            matchBox.style.position = 'absolute';
            matchBox.style.left = `${currentX}px`;
            matchBox.style.top = `${currentY}px`;
            matchBox.style.width = `${boxWidth}px`;
            matchBox.style.height = `${boxHeight}px`;
            matchBox.style.boxSizing = 'border-box';
            
            if (match.winner) matchBox.style.borderLeft = '4px solid #a6e3a1'; 
            else matchBox.style.borderLeft = '4px solid #f38ba8'; 

            const p1Name = match.player1 ? match.player1.name : "TBD";
            const p2Name = match.player2 ? match.player2.name : "TBD";

            if (match.winner || match.isBye) {
                let p1Display = p1Name; let p2Display = p2Name;
                if (match.winner === match.player1 || match.winner === "tie") p1Display = `<strong>${p1Name}</strong>`;
                if (match.winner === match.player2 || match.winner === "tie") p2Display = `<strong>${p2Name}</strong>`;

                matchBox.innerHTML = `
                    <div style="${match.winner === match.player1 ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p1Display} ${match.winner ? `(${match.score1})` : ''}</div>
                    <div style="${match.winner === match.player2 ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p2Display} ${match.winner ? `(${match.score2})` : ''}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                        <small style="color:gray;">${match.isBye ? 'Auto-Advance' : (match.winner === "tie" ? 'TIE' : 'Completed')}</small>
                        ${!match.isBye ? `<button class="btn-edit-match" data-matchid="${match.id}" style="padding:2px 8px; font-size:10px; background:#f9e2af; color:#1e1e2e; border:none; border-radius:3px; cursor:pointer; position:relative; z-index:10;">Edit</button>` : ''}
                    </div>
                `;
            } else {
                if (isActiveStage) {
                    matchBox.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p1Name}</span>
                            <!-- Shortened input width from 40px to 35px for more name room! -->
                            <input type="number" id="s1-${match.id}" style="width:35px; padding:2px; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="0">
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p2Name}</span>
                            <input type="number" id="s2-${match.id}" style="width:35px; padding:2px; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="0">
                        </div>
                        <!-- Moved the Submit button inside the box layout -->
                        <button class="btn-report" data-matchid="${match.id}" style="position:absolute; right:5px; top:25px; height:35px; width:40px; font-size:14px; cursor:pointer; background:var(--accent); border:none; border-radius:4px; font-weight:bold; z-index:10;">✓</button>
                    `;
                } else {
                     matchBox.innerHTML = `<div>${p1Name}</div><div>${p2Name}</div><small style="color:gray;">Pending</small>`;
                }
            }
            board.appendChild(matchBox);
        });
    });

    applyPanAndZoom(document.getElementById('bracket-viewport'), board);
}

// Global object to remember camera position across redraws!
window.bracketCamera = window.bracketCamera || { x: 0, y: 0, scale: 1 };

export function applyPanAndZoom(viewport, board) {
    let panning = false, startX = 0, startY = 0;

    function setTransform() {
        board.style.transform = `translate(${window.bracketCamera.x}px, ${window.bracketCamera.y}px) scale(${window.bracketCamera.scale})`;
    }

    // Instantly apply the saved camera position on load!
    setTransform();

    viewport.addEventListener('mousedown', (e) => {
        if (['INPUT', 'BUTTON'].includes(e.target.tagName)) return; 
        e.preventDefault();
        panning = true;
        viewport.style.cursor = 'grabbing';
        startX = e.clientX - window.bracketCamera.x;
        startY = e.clientY - window.bracketCamera.y;
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!panning) return;
        window.bracketCamera.x = e.clientX - startX;
        window.bracketCamera.y = e.clientY - startY;
        setTransform();
    });

    window.addEventListener('mouseup', () => {
        panning = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        
        let xs = (e.clientX - window.bracketCamera.x) / window.bracketCamera.scale;
        let ys = (e.clientY - window.bracketCamera.y) / window.bracketCamera.scale;
        
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        window.bracketCamera.scale += delta;
        window.bracketCamera.scale = Math.min(Math.max(0.3, window.bracketCamera.scale), 2);
        
        window.bracketCamera.x = e.clientX - xs * window.bracketCamera.scale;
        window.bracketCamera.y = e.clientY - ys * window.bracketCamera.scale;
        
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

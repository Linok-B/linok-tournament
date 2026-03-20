import { calculateTiebreakers } from '../engine/systems/tiebreakers.js';

export function renderPlayerList(players, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 
    if (players.length === 0) return;

    const sortedPlayers = [...players].sort((a, b) => a.seed - b.seed);
    
    sortedPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.setAttribute('data-id', player.id);
        
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.padding = '10px 15px';
        card.style.marginBottom = '10px';
        card.style.backgroundColor = 'var(--bg-panel)';
        card.style.borderRadius = '6px';
        card.style.borderLeft = '4px solid var(--accent)';
        
        card.style.gap = '10px';
        
        card.innerHTML = `
            <div class="drag-handle" style="color: #89b4fa; font-size: 16px; font-weight: bold; cursor: grab; padding: 5px; flex-shrink: 0;">⋮⋮</div>
            
            <!-- This container GROWS to fill all available space! -->
            <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; min-width: 0;">
                <strong title="${player.name}" style="color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span class="seed-number" style="color: gray; margin-right: 5px;">${player.seed}.</span>${player.name}
                </strong>
                <span style="font-size: 12px; color: gray; flex-shrink: 0;">(ELO: ${player.elo})</span>
            </div>
            
            <button class="btn-remove-player" data-id="${player.id}" style="background-color: var(--danger); color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; flex-shrink: 0;">X</button>
        `;
        
        container.appendChild(card);
    });

    // --- NEW: BUTTERY SMOOTH MOUSE DRAG ENGINE ---
    applyCustomDragAndDrop(container);
}

// THE MATH BEHIND PERFECT DRAG AND DROP
function applyCustomDragAndDrop(container) {
    let draggingElement = null;
    let placeholder = null;
    let offsetY = 0;
    
    // Auto-scroll variables
    const scrollParent = document.querySelector('.controls-panel'); 
    let scrollInterval = null;

    container.addEventListener('mousedown', (e) => {
        // Only start dragging if they clicked the '⋮⋮' handle!
        if (!e.target.classList.contains('drag-handle')) return;
        
        e.preventDefault();
        const card = e.target.closest('.player-card');
        
        // 1. Calculate where they clicked on the card so it doesn't snap to the top-left of the mouse
        const rect = card.getBoundingClientRect();
        offsetY = e.clientY - rect.top;
        
        // 2. Create the exact-size Placeholder (The Hole)
        placeholder = card.cloneNode(true);
        placeholder.classList.add('is-placeholder');
        container.insertBefore(placeholder, card);
        
        // 3. Turn the actual card into a "Ghost"
        draggingElement = card;
        draggingElement.classList.add('is-dragging');
        draggingElement.style.top = `${e.clientY - offsetY}px`;
        draggingElement.style.left = `${rect.left}px`;
        
        document.body.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggingElement) return;
        
        // 1. Move the Ghost
        draggingElement.style.top = `${e.clientY - offsetY}px`;
        
        // 2. Find what card we are hovering over (excluding the ghost itself)
        // We use elementsFromPoint to see what's directly underneath the mouse!
        const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
        const hoveredCard = elementsUnderMouse.find(el => el.classList.contains('player-card') && !el.classList.contains('is-dragging'));
        
        // 3. Move the Placeholder (The Hole) up or down the list!
        if (hoveredCard && hoveredCard !== placeholder) {
            const hoverRect = hoveredCard.getBoundingClientRect();
            const hoverMiddleY = hoverRect.top + (hoverRect.height / 2);
            
            // If mouse is above the middle of the hovered card, move the hole above it.
            if (e.clientY < hoverMiddleY) {
                container.insertBefore(placeholder, hoveredCard);
            } else {
                container.insertBefore(placeholder, hoveredCard.nextSibling);
            }
        }
        
        // --- AUTO SCROLLING MATH ---
        const scrollRect = scrollParent.getBoundingClientRect();
        const edgeThreshold = 50; // Pixels from the top/bottom edge to trigger scroll
        
        clearInterval(scrollInterval);
        if (e.clientY < scrollRect.top + edgeThreshold) {
            // Scroll UP
            scrollInterval = setInterval(() => scrollParent.scrollTop -= 5, 16);
        } else if (e.clientY > scrollRect.bottom - edgeThreshold) {
            // Scroll DOWN
            scrollInterval = setInterval(() => scrollParent.scrollTop += 5, 16);
        }
    });

    document.addEventListener('mouseup', () => {
        if (!draggingElement) return;
        
        clearInterval(scrollInterval);
        document.body.style.cursor = 'default';
        
        // 1. Swap the Ghost back into the Hole
        container.insertBefore(draggingElement, placeholder);
        draggingElement.classList.remove('is-dragging');
        draggingElement.style.top = '';
        draggingElement.style.left = '';
        
        // 2. Delete the Hole
        placeholder.remove();
        
        // 3. Read the new physical order from the DOM and update the Engine!
        const newOrderIds = Array.from(container.children).map(card => card.getAttribute('data-id'));
        
        // Dispatch event to app.js
        container.dispatchEvent(new CustomEvent('playerListReordered', {
            bubbles: true,
            detail: { newOrderIds }
        }));
        
        draggingElement = null;
        placeholder = null;
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

// In js/ui/renderer.js - Replace drawBracketMath

function drawBracketMath(stage, isActiveStage) {
    const board = document.getElementById('bracket-board');
    board.innerHTML = '<svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>';
    const svgLayer = document.getElementById('bracket-lines');
    
    const boxWidth = 280; 
    const boxHeight = 85;
    const gapX = 60;  
    const gapY = 20;  
    const startX = 50; 
    const startY = 60; 

    const matchCoordinates = {}; 

    stage.data.rounds.forEach((roundMatches, roundIndex) => {
        const currentX = startX + (roundIndex * (boxWidth + gapX));

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
                const prevRound = stage.data.rounds[roundIndex - 1];
                const parent1 = prevRound[matchIndex * 2];
                const parent2 = prevRound[(matchIndex * 2) + 1];
                
                const p1Y = parent1 ? matchCoordinates[parent1.id]?.y : 0;
                const p2Y = parent2 ? matchCoordinates[parent2.id]?.y : p1Y; 

                currentY = (p1Y + p2Y) / 2;

                // CORRECT SVG ORTHOGONAL LINES (The "Y" shape)
                if (parent1 && parent2 && p1Y !== p2Y) {
                    const lineStartX = currentX - gapX;
                    const midX = lineStartX + (gapX / 2);
                    
                    // Top Parent Line
                    svgLayer.innerHTML += `<path d="M ${lineStartX} ${p1Y + (boxHeight/2)} L ${midX} ${p1Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    // Bottom Parent Line
                    svgLayer.innerHTML += `<path d="M ${lineStartX} ${p2Y + (boxHeight/2)} L ${midX} ${p2Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                } else if (parent1) {
                    // Straight line for byes
                    const lineStartX = currentX - gapX;
                    svgLayer.innerHTML += `<path d="M ${lineStartX} ${p1Y + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                }
            } else {
                // FIXED SWISS/ROUND ROBIN SPACING (No massive expanding gaps!)
                if (stage.config.type === "single_elimination") {
                    const multiplier = Math.pow(2, roundIndex); 
                    currentY = startY + (matchIndex * (boxHeight + gapY) * multiplier);
                } else {
                    currentY = startY + (matchIndex * (boxHeight + gapY)); // Tightly packed for Swiss!
                }
            }

            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };

            // HTML GENERATION WITH STRICT FLEXBOX LAYOUT
            const matchBox = document.createElement('div');
            matchBox.className = 'match-box';
            matchBox.style.position = 'absolute';
            matchBox.style.left = `${currentX}px`;
            matchBox.style.top = `${currentY}px`;
            matchBox.style.width = `${boxWidth}px`;
            matchBox.style.height = `${boxHeight}px`;
            matchBox.style.padding = '8px';
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
                    <div style="display:flex; height:100%; align-items:center;">
                        <div style="flex-grow:1; overflow:hidden; width: 130px;">
                            <div title="${p1Name}" style="${match.winner === match.player1 ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:5px; cursor:default;">${p1Display}</div>
                            <div title="${p2Name}" style="${match.winner === match.player2 ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:default;">${p2Display}</div>
                        </div>
                        <div style="min-width: 30px; text-align:right; font-weight:bold; margin-right: 10px;">
                            <div style="margin-bottom:5px;">${match.score1}</div>
                            <div>${match.score2}</div>
                        </div>
                        <div style="display:flex; flex-direction:column; justify-content:center; align-items:flex-end;">
                            <small style="color:gray; font-size:10px; margin-bottom:5px;">${match.isBye ? 'Auto' : (match.winner === "tie" ? 'TIE' : 'Done')}</small>
                            ${!match.isBye ? `<button class="btn-edit-match" data-matchid="${match.id}" style="padding:4px 8px; font-size:10px; background:#f9e2af; color:#1e1e2e; border:none; border-radius:3px; cursor:pointer;">Edit</button>` : ''}
                        </div>
                    </div>
                `;
            } else {
                if (isActiveStage) {
                    matchBox.innerHTML = `
                        <div style="display:flex; height:100%; align-items:center;">
                            <div style="overflow:hidden; padding-right:10px; width: 110px;">
                                <div title="${p1Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:10px; height: 20px; line-height: 20px; cursor:default;">${p1Name}</div>
                                <div title="${p2Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; height: 20px; line-height: 20px; cursor:default;">${p2Name}</div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:8px;">
                                <input type="number" id="s1-${match.id}" style="width:55px; height:20px; box-sizing:border-box; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="${match.score1}">
                                <input type="number" id="s2-${match.id}" style="width:55px; height:20px; box-sizing:border-box; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="${match.score2}">
                            </div>
                            <button class="btn-report" data-matchid="${match.id}" style="margin-left:10px; height:48px; width:40px; font-size:16px; cursor:pointer; background:var(--accent); color:var(--bg-dark); border:none; border-radius:4px; font-weight:bold;">✓</button>
                        </div>
                    `;
                } else {
                     matchBox.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; height:100%;"><div title="${p1Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p1Name}</div><div title="${p2Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p2Name}</div><small style="color:gray; margin-top:5px;">Pending</small></div>`;
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
        
        // NEW: Get exact position of the viewport on the screen
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate mouse position relative to the current zoom/pan
        let xs = (mouseX - window.bracketCamera.x) / window.bracketCamera.scale;
        let ys = (mouseY - window.bracketCamera.y) / window.bracketCamera.scale;
        
        let delta = e.deltaY > 0 ? -0.1 : 0.1;
        window.bracketCamera.scale += delta;
        window.bracketCamera.scale = Math.min(Math.max(0.3, window.bracketCamera.scale), 2);
        
        // Re-center around mouse cursor
        window.bracketCamera.x = mouseX - xs * window.bracketCamera.scale;
        window.bracketCamera.y = mouseY - ys * window.bracketCamera.scale;
        
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

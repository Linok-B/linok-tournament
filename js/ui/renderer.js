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

        //Force the card to include padding in its width calculation so it CANNOT grow
        card.style.boxSizing = 'border-box';
        card.style.width = '100%'; 
        
        card.innerHTML = `
            <div class="drag-handle" style="color: #89b4fa; font-size: 16px; font-weight: bold; cursor: grab; padding: 5px; flex-shrink: 0;">⋮⋮</div>
            
            <!-- This container GROWS to fill all available space! -->
            <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; min-width: 0;">
                <strong title="${player.name}" style="color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <!-- ONLY THE NUMBER GOES IN THIS SPAN! -->
                    <span class="seed-number" style="color: gray; margin-right: 5px;">${player.seed}</span>. ${player.name}
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
        if (!e.target.classList.contains('drag-handle')) return;
        
        e.preventDefault();
        const card = e.target.closest('.player-card');
        const rect = card.getBoundingClientRect();
        offsetY = e.clientY - rect.top;
        
        placeholder = card.cloneNode(true);
        placeholder.classList.add('is-placeholder');
        container.insertBefore(placeholder, card);
        
        draggingElement = card;
        draggingElement.classList.add('is-dragging');
        
        // Dynamically set the Ghost width to perfectly match the physical card
        draggingElement.style.width = `${rect.width}px`; 
        
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
    drawBracketMath(stageToRender, isActiveStage, tournament);
}

// ---------------------------------------------------------
// THE ABSOLUTE POSITIONING MATH ENGINE (Draws Boxes & SVG Lines, that's it)
// ---------------------------------------------------------

function drawBracketMath(stage, isActiveStage, tournament) {
    const board = document.getElementById('bracket-board');
    board.innerHTML = '<svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>';
    const svgLayer = document.getElementById('bracket-lines');
    
    const boxWidth = 280; 
    const boxHeight = 95;
    const gapX = 60;  
    const gapY = 20;  
    const startX = 50; 
    const startY = 60; 

    const matchCoordinates = {}; 
    const showFull = tournament.settings.showFullBracket;

    // Determine how many rounds to draw
    let totalRoundsToDraw = stage.data.rounds.length;
    if (showFull) {
        if (stage.config.type === "single_elimination" || stage.config.type === "double_elimination") {
            totalRoundsToDraw = Math.max(stage.data.rounds.length, Math.ceil(Math.log2(stage.data.bracketSize))); 
            // Note: Double elim has ~2x the rounds, so this is a rough estimate for ghosting. 
            // A true dynamic ghost generator for DE is too complex for a preview, so it will just preview the current phase.
        } else {
            totalRoundsToDraw = stage.config.maxRounds || (stage.data.totalRounds || stage.data.rounds.length);
        }
    }

    // --- DOUBLE ELIMINATION Y-OFFSET MATH ---
    // We need to know how tall the Winner's bracket is so we can draw the Loser's bracket below it!
    let losersOffsetY = startY; 
    if (stage.config.type === "double_elimination") {
        // Find the maximum number of matches in Winner's Round 1 to calculate the height
        const wR1Count = stage.data.rounds[0].filter(m => m.bracket === "winners").length;
        losersOffsetY = startY + (wR1Count * (boxHeight + gapY)) + 150; // Add 150px gap between brackets
    }

    for (let roundIndex = 0; roundIndex < totalRoundsToDraw; roundIndex++) {
        const currentX = startX + (roundIndex * (boxWidth + gapX));
        
        const header = document.createElement('h3');
        header.innerText = `Round ${roundIndex + 1}`;
        header.style.cssText = `position:absolute; left:${currentX}px; top:10px; width:${boxWidth}px; text-align:center; margin:0; color: var(--text-main);`;
        board.appendChild(header);

        let matchesToDraw = stage.data.rounds[roundIndex] || [];

        // Ghost Match Logic (Simplified for now)
        if (matchesToDraw.length === 0 && showFull) {
             if (stage.config.type !== "double_elimination") {
                const numGhosts = stage.config.type === "single_elimination" 
                    ? stage.data.bracketSize / Math.pow(2, roundIndex + 1)
                    : stage.data.rounds[0].length;
                for (let i = 0; i < numGhosts; i++) matchesToDraw.push({ id: `ghost-${roundIndex}-${i}`, isGhost: true });
             }
        }

        // We must draw Winners first, then Losers, so the spacing is consistent
        const wMatches = matchesToDraw.filter(m => m.bracket === "winners" || m.bracket === undefined);
        const lMatches = matchesToDraw.filter(m => m.bracket === "losers");
        const gfMatches = matchesToDraw.filter(m => m.bracket === "grand_finals");

        // 1. DRAW WINNERS BRACKET (And Single Elim / Swiss)
        wMatches.forEach((match, matchIndex) => {
            let currentY = 0;

            if ((stage.config.type === "single_elimination" || stage.config.type === "double_elimination") && roundIndex > 0) {
                if (match.isThirdPlaceMatch) {
                    const finalsY = matchCoordinates[stage.data.rounds[roundIndex][0].id]?.y || startY;
                    currentY = finalsY + 140;
                } else {
                    // Find Parents
                    const prevRound = stage.data.rounds[roundIndex - 1];
                    const parent1 = prevRound.filter(m => m.bracket === match.bracket)[matchIndex * 2];
                    const parent2 = prevRound.filter(m => m.bracket === match.bracket)[(matchIndex * 2) + 1];
                    
                    const p1Y = parent1 ? matchCoordinates[parent1.id]?.y : 0;
                    const p2Y = parent2 ? matchCoordinates[parent2.id]?.y : p1Y; 

                    currentY = (p1Y + p2Y) / 2;

                    // DRAW SVG LINES (Only if both parents exist)
                    if (parent1 && parent2 && p1Y !== p2Y) {
                        const lineStartX = currentX - gapX;
                        const midX = lineStartX + (gapX / 2);
                        const centerY = currentY + (boxHeight / 2);
                        
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${midX} ${p1Y + (boxHeight/2)} L ${midX} ${centerY} L ${currentX} ${centerY}" stroke="#45475a" stroke-width="2" fill="none" />`;
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p2Y + (boxHeight/2)} L ${midX} ${p2Y + (boxHeight/2)} L ${midX} ${centerY} L ${currentX} ${centerY}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    } else if (parent1) {
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    }
                }
            } else {
                // Round 1 Spacing
                if (stage.config.type === "single_elimination" || stage.config.type === "double_elimination") {
                    const multiplier = Math.pow(2, roundIndex); 
                    currentY = startY + (matchIndex * (boxHeight + gapY) * multiplier);
                } else {
                    currentY = startY + (matchIndex * (boxHeight + gapY)); // Swiss
                }
            }

            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage));
        });

        // 2. DRAW LOSERS BRACKET
        lMatches.forEach((match, matchIndex) => {
            let currentY = 0;
            const prevRound = stage.data.rounds[roundIndex - 1];
            const prevLosers = prevRound.filter(m => m.bracket === "losers");

            // Loser's Bracket Math is tricky. 
            // In "Minor" rounds (where Winners drop down), there are straight lines.
            // In "Major" rounds (where Losers play Losers), the lines form a Y-shape.
            if (prevLosers.length > 0 && prevLosers.length === lMatches.length) {
                // Straight line from previous Loser match
                const parent = prevLosers[matchIndex];
                currentY = matchCoordinates[parent.id].y;
                
                // Draw straight line
                svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                
                // Draw drop-down line from Winner's bracket (Visual flair!)
                // (We won't draw complex routing curves here yet, just a dashed line from the top to show a drop happened)
                svgLayer.innerHTML += `<path d="M ${currentX - (gapX/2)} ${currentY - 100} L ${currentX - (gapX/2)} ${currentY + (boxHeight/2)}" stroke="#f38ba8" stroke-width="2" stroke-dasharray="5,5" fill="none" />`;

            } else if (prevLosers.length > 0) {
                // Y-Shape line (Major Round)
                const parent1 = prevLosers[matchIndex * 2];
                const parent2 = prevLosers[(matchIndex * 2) + 1];
                const p1Y = parent1 ? matchCoordinates[parent1.id]?.y : 0;
                const p2Y = parent2 ? matchCoordinates[parent2.id]?.y : p1Y; 

                currentY = (p1Y + p2Y) / 2;

                if (parent1 && parent2 && p1Y !== p2Y) {
                    const midX = (currentX - gapX) + (gapX / 2);
                    const centerY = currentY + (boxHeight / 2);
                    svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${midX} ${p1Y + (boxHeight/2)} L ${midX} ${centerY} L ${currentX} ${centerY}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p2Y + (boxHeight/2)} L ${midX} ${p2Y + (boxHeight/2)} L ${midX} ${centerY} L ${currentX} ${centerY}" stroke="#45475a" stroke-width="2" fill="none" />`;
                }
            } else {
                // Round 1 of Loser's Bracket (First drops)
                currentY = losersOffsetY + (matchIndex * (boxHeight + gapY) * 2);
            }

            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage));
        });

        // 3. DRAW GRAND FINALS
        gfMatches.forEach((match, matchIndex) => {
            // Position Grand Finals perfectly between Winners and Losers brackets!
            const wFinals = stage.data.rounds.flat().reverse().find(m => m.bracket === "winners");
            const lFinals = stage.data.rounds.flat().reverse().find(m => m.bracket === "losers");
            
            const wY = wFinals ? matchCoordinates[wFinals.id].y : startY;
            const lY = lFinals ? matchCoordinates[lFinals.id].y : losersOffsetY;
            
            const currentY = (wY + lY) / 2 + (matchIndex * (boxHeight + gapY)); // If Reset match, draw it below

            // Draw long epic lines from Winners/Losers champions to the GF box!
            if (wFinals && lFinals && matchIndex === 0) {
                const wX = matchCoordinates[wFinals.id].x;
                const lX = matchCoordinates[lFinals.id].x;
                const midX = currentX - (gapX / 2);
                
                // From Winners
                svgLayer.innerHTML += `<path d="M ${wX} ${wY + (boxHeight/2)} L ${midX} ${wY + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#a6e3a1" stroke-width="3" fill="none" />`;
                // From Losers
                svgLayer.innerHTML += `<path d="M ${lX} ${lY + (boxHeight/2)} L ${midX} ${lY + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#f38ba8" stroke-width="3" fill="none" />`;
            } else if (matchIndex > 0) {
                // Bracket Reset Line (Straight)
                svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#f9e2af" stroke-width="3" fill="none" />`;
            }

            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage));
        });
    });

    applyPanAndZoom(document.getElementById('bracket-viewport'), board);
}

// ---------------------------------------------------------
// HELPER FUNCTION TO GENERATE THE HTML BOX
// ---------------------------------------------------------
function createMatchBoxHTML(match, x, y, width, height, isActiveStage) {
    const matchBox = document.createElement('div');
    matchBox.className = 'match-box';
    matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; padding:8px; box-sizing:border-box;`;
    
    if (match.isGhost) {
        matchBox.style.opacity = "0.3";
        matchBox.style.border = "1px dashed #45475a";
        matchBox.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; height:100%; color:gray; font-style:italic;"><div>TBD</div><div style="margin-top:10px;">TBD</div></div>`;
        return matchBox;
    }

    let borderColor = '#45475a'; // default
    if (match.winner) borderColor = '#a6e3a1'; // Green
    else if (!isActiveStage) borderColor = '#f38ba8'; // Red (Pending)
    matchBox.style.borderLeft = `4px solid ${borderColor}`; 

    const p1Name = match.player1 ? match.player1.name : "TBD";
    const p2Name = match.player2 ? match.player2.name : "TBD";
    let p1Disp = (match.winner?.id === match.player1?.id || match.winner === "tie") ? `<strong>${p1Name}</strong>` : p1Name;
    let p2Disp = (match.winner?.id === match.player2?.id || match.winner === "tie") ? `<strong>${p2Name}</strong>` : p2Name;

    // BRACKET LABEL COLOR LOGIC
    let bracketColor = "gray";
    let bracketLabel = "";
    if (match.bracket === "winners") { bracketColor = "#a6e3a1"; bracketLabel = "[W]"; }
    else if (match.bracket === "losers") { bracketColor = "#f38ba8"; bracketLabel = "[L]"; }
    else if (match.bracket === "grand_finals") { bracketColor = "#f9e2af"; bracketLabel = match.bracketReset ? "[RESET]" : "[GF]"; }

    const statusHtml = `<small style="color:gray; font-size:10px; margin-bottom:5px;">
        <b style="color:${bracketColor}">${bracketLabel}</b> 
        ${match.isThirdPlaceMatch ? '3rd' : (match.isBye ? 'Auto' : 'Done')}
    </small>`;

    if (match.winner || match.isBye) {
        matchBox.innerHTML = `
            <div style="display:flex; height:100%; align-items:center;">
                <div style="flex-grow:1; overflow:hidden; width: 130px;">
                    <div title="${p1Name}" style="${match.winner?.id === match.player1?.id ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:5px;">${p1Disp}</div>
                    <div title="${p2Name}" style="${match.winner?.id === match.player2?.id ? 'color:#a6e3a1;' : ''} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p2Disp}</div>
                </div>
                <div style="min-width: 30px; text-align:right; font-weight:bold; margin-right: 10px;">
                    <div style="margin-bottom:5px;">${match.score1}</div>
                    <div>${match.score2}</div>
                    ${match.draws ? `<div style="font-size:10px; color:gray; margin-top:2px;">${match.draws} Ties</div>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:flex-end;">
                    ${statusHtml}
                    ${!match.isBye ? `<button class="btn-edit-match" data-matchid="${match.id}" style="padding:4px 8px; font-size:10px; background:#f9e2af; color:#1e1e2e; border:none; border-radius:3px; cursor:pointer;">Edit</button>` : ''}
                </div>
            </div>`;
    } else if (isActiveStage) {
        matchBox.innerHTML = `
            <div style="display:flex; height:100%; align-items:center;">
                <div style="overflow:hidden; padding-right:10px; width: 140px;">
                    <div title="${p1Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:5px; height: 20px; line-height: 20px;">${p1Name}</div>
                    <div title="${p2Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:5px; height: 20px; line-height: 20px;">${p2Name}</div>
                    <div style="font-size:10px; color:gray; text-align:right; height: 16px; line-height: 16px;">Ties:</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:3px;">
                    <input type="number" id="s1-${match.id}" style="width:45px; height:20px; box-sizing:border-box; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="${match.score1}">
                    <input type="number" id="s2-${match.id}" style="width:45px; height:20px; box-sizing:border-box; background:var(--bg-dark); color:white; border:1px solid #45475a;" value="${match.score2}">
                    <input type="number" id="d-${match.id}" style="width:45px; height:16px; box-sizing:border-box; background:var(--bg-dark); color:gray; font-size:10px; border:1px solid #45475a;" value="${match.draws || 0}">
                </div>
                <button class="btn-report" data-matchid="${match.id}" style="margin-left:10px; height:48px; width:40px; cursor:pointer; background:var(--accent); color:var(--bg-dark); border:none; border-radius:4px; font-weight:bold;">✓</button>
            </div>
            <div style="position:absolute; top:-15px; left:5px;">${statusHtml}</div>
        `;
    } else {
        matchBox.innerHTML = `
            <div style="position:absolute; top:-15px; left:5px;">${statusHtml}</div>
            <div style="display:flex; flex-direction:column; justify-content:center; height:100%;">
                <div title="${p1Name}">${p1Name}</div>
                <div title="${p2Name}">${p2Name}</div>
                <small style="color:gray; margin-top:5px;">Pending</small>
            </div>`;
    }
    return matchBox;
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

    const sortFunction = calculateTiebreakers(tournament.players, tournament.stages);
    
    // Determine which tiebreaker array to use
    let viewIndex = window.viewingStageIndex !== undefined ? window.viewingStageIndex : tournament.stages.length - 1;
    if (viewIndex < 0) viewIndex = 0;
    let stageTiebreakers = tournament.settings.tiebreakers; 
    if (tournament.stages.length > 0 && tournament.stages[viewIndex].config.tiebreakers) {
        stageTiebreakers = tournament.stages[viewIndex].config.tiebreakers;
    }

    const sortedPlayers = [...tournament.players].sort((a, b) => sortFunction(a, b, stageTiebreakers));

    // 1. Update the Header HTML
    let html = `
        <h2 style="margin-top: 40px; border-top: 1px solid #45475a; padding-top: 20px;">Current Standings</h2>
        <table style="width: 100%; border-collapse: collapse; text-align: left; background: var(--bg-panel);">
            <thead>
                <tr style="border-bottom: 2px solid var(--accent);">
                    <th style="padding: 10px;">Rank</th>
                    <th style="padding: 10px;">Name</th>
                    <th style="padding: 10px;">Points</th>
                    <th style="padding: 10px;">Match (W-L-D)</th>
                    <th style="padding: 10px;">Games (W-L-D)</th> 
                    <th style="padding: 10px;">Buchholz</th>
                </tr>
            </thead>
            <tbody>
    `;

    // 2. Update the Player Loop HTML
    let currentDisplayRank = 1;

    sortedPlayers.forEach((player, index) => {
        if (index > 0) {
            const prevPlayer = sortedPlayers[index - 1];
            const isTied = sortFunction(player, prevPlayer, stageTiebreakers) === 0;
            if (!isTied) {
                currentDisplayRank = index + 1;
            }
        }

        html += `
            <tr style="border-bottom: 1px solid #45475a;">
                <td style="padding: 10px;"><b>${currentDisplayRank}</b></td>
                <td style="padding: 10px;">${player.name}</td>
                <td style="padding: 10px; font-weight: bold; color: var(--accent);">${player.stats.points}</td>
                <td style="padding: 10px;">${player.stats.matchWins}-${player.stats.matchLosses}-${player.stats.matchDraws}</td>
                <!-- CHANGED TO INCLUDE gameDraws -->
                <td style="padding: 10px;">${player.stats.gameWins}-${player.stats.gameLosses}-${player.stats.gameDraws}</td>
                <td style="padding: 10px;">${player.stats.buchholz}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

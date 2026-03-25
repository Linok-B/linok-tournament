import { calculateTiebreakers } from '../engine/systems/tiebreakers.js';
import { getSkeleton } from '../engine/formats/registry.js';

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
    
    const boxWidth = 280; const boxHeight = 95;
    const gapX = 60; const gapY = 20;  
    const startX = 50; const startY = 60; 

    const matchCoordinates = {}; 
    const showFull = tournament.settings.showFullBracket;

    // --- 1. THE PERFECT MERGER ---
    let visualRounds = [];
    
    if (showFull && stage.config.type === "double_elimination") {
        const skeleton = getSkeleton("double_elimination", stage.data.bracketSize);
        skeleton.forEach((skelRound, rIndex) => {
            const realRound = stage.data.rounds[rIndex] || [];
            const mergedRound = [];
            
            // Merge perfectly by Bracket Type so Real Matches are NEVER overwritten
            ["winners", "losers", "grand_finals"].forEach(bracket => {
                const realM = realRound.filter(m => m.bracket === bracket);
                const ghostM = skelRound.filter(m => m.bracket === bracket);
                const maxLen = Math.max(realM.length, ghostM.length);
                for (let i = 0; i < maxLen; i++) {
                    mergedRound.push(realM[i] || ghostM[i]);
                }
            });
            // Push any un-bracketed matches (like 3rd place) just in case
            mergedRound.push(...realRound.filter(m => !["winners", "losers", "grand_finals"].includes(m.bracket)));
            visualRounds.push(mergedRound);
        });
    } else if (showFull && stage.config.type === "single_elimination") {
        const totalRoundsToDraw = Math.log2(stage.data.bracketSize);
        for (let r = 0; r < totalRoundsToDraw; r++) {
            if (stage.data.rounds[r]) {
                visualRounds.push(stage.data.rounds[r]);
            } else {
                let ghostRound = [];
                const numGhosts = stage.data.bracketSize / Math.pow(2, r + 1);
                for (let i = 0; i < numGhosts; i++) ghostRound.push({ id: `ghost-${r}-${i}`, isGhost: true });
                if (numGhosts === 1 && tournament.settings.playThirdPlaceMatch) {
                    ghostRound.push({ id: `ghost-${r}-bronze`, isGhost: true, isThirdPlaceMatch: true });
                }
                visualRounds.push(ghostRound);
            }
        }
    } else if (showFull) {
        const totalRoundsToDraw = stage.config.maxRounds || (stage.data.totalRounds || stage.data.rounds.length);
        for (let r = 0; r < totalRoundsToDraw; r++) {
            if (stage.data.rounds[r]) {
                visualRounds.push(stage.data.rounds[r]);
            } else {
                let ghostRound = [];
                const numGhosts = stage.data.rounds[0].length;
                for (let i = 0; i < numGhosts; i++) ghostRound.push({ id: `ghost-${r}-${i}`, isGhost: true });
                visualRounds.push(ghostRound);
            }
        }
    } else {
        visualRounds = stage.data.rounds;
    }

    const totalRoundsToDraw = visualRounds.length;
    let losersOffsetY = startY; 
    if (stage.config.type === "double_elimination") {
        const wR1Count = visualRounds[0].filter(m => m.bracket === "winners" || !m.bracket).length;
        losersOffsetY = startY + (wR1Count * (boxHeight + gapY)) + 150; 
    }

    // --- 2. DRAWING LOOP ---
    for (let roundIndex = 0; roundIndex < totalRoundsToDraw; roundIndex++) {

        const currentX = startX + (roundIndex * (boxWidth + gapX));
        const header = document.createElement('h3');
        header.innerText = `Round ${roundIndex + 1}`;
        header.style.cssText = `position:absolute; left:${currentX}px; top:10px; width:${boxWidth}px; text-align:center; margin:0; color: var(--text-main);`;
        board.appendChild(header);

        let matchesToDraw = visualRounds[roundIndex] || [];

        // If this round already physically exists in the data, strip out any ghosts we merged into it.
        if (roundIndex < stage.data.rounds.length) {
            matchesToDraw = matchesToDraw.filter(m => !m.isGhost);
        }

        const wMatches = matchesToDraw.filter(m => m.bracket === "winners" || m.bracket === undefined);
        const lMatches = matchesToDraw.filter(m => m.bracket === "losers");
        const gfMatches = matchesToDraw.filter(m => m.bracket === "grand_finals");

        if (stage.data.isComplete && !visualRounds[roundIndex]) break; 
        
        // WINNERS
        wMatches.forEach((match, matchIndex) => {
            let currentY = 0;
            if ((stage.config.type === "single_elimination" || stage.config.type === "double_elimination") && roundIndex > 0) {
                if (match.isThirdPlaceMatch) {
                    const actualRound = visualRounds[roundIndex];
                    let finalsY = (actualRound && actualRound[0]) ? matchCoordinates[actualRound[0].id]?.y : startY;
                    currentY = (finalsY || startY) + 140;
                } else {
                    const prevRound = visualRounds[roundIndex - 1] || [];
                    const parent1 = prevRound.filter(m => m.bracket === match.bracket || !m.bracket)[matchIndex * 2];
                    const parent2 = prevRound.filter(m => m.bracket === match.bracket || !m.bracket)[(matchIndex * 2) + 1];
                    
                    // Only draw lines if the parent was NOT a Phantom match!
                    let p1Y = (parent1 && !parent1.winner?.isPhantom) ? matchCoordinates[parent1.id]?.y : undefined;
                    let p2Y = (parent2 && !parent2.winner?.isPhantom) ? matchCoordinates[parent2.id]?.y : undefined;
                    // If no parent 2 but parent 1 exists, align straight!
                    if (p1Y !== undefined && p2Y === undefined) p2Y = p1Y;

                    // Force a straight line if this match is a real Bye!
                    /* if (!match.isGhost && match.isBye) {
                        p2Y = p1Y; 
                    } */

                    currentY = p1Y !== undefined && p2Y !== undefined ? (p1Y + p2Y) / 2 : startY;

                    if (p1Y !== undefined && p2Y !== undefined && p1Y !== p2Y) {
                        const midX = (currentX - gapX) + (gapX / 2);
                        const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${midX} ${p1Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash}/>`;
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p2Y + (boxHeight/2)} L ${midX} ${p2Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash}/>`;
                    } else if (p1Y !== undefined) {
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" />`;
                    }
                }
            } else {
                if (stage.config.type === "single_elimination" || stage.config.type === "double_elimination") {
                    currentY = startY + (matchIndex * (boxHeight + gapY) * Math.pow(2, roundIndex));
                } else {
                    currentY = startY + (matchIndex * (boxHeight + gapY)); 
                }
            }
            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage, tournament));
        });

        // LOSERS
        lMatches.forEach((match, matchIndex) => {
            let currentY = 0;
            const prevRound = visualRounds[roundIndex - 1] || [];
            const prevLosers = prevRound.filter(m => m.bracket === "losers");

            const isMinorRound = prevLosers.length === lMatches.length;
            const isFirstRound = prevLosers.length === 0;

            if (isFirstRound || isMinorRound) {
                let isParentPhantom = false;

                if (isMinorRound) {
                    const parent = prevLosers[matchIndex];
                    isParentPhantom = parent && parent.winner?.isPhantom;
                    
                    if (!isParentPhantom && parent) {
                        currentY = matchCoordinates[parent.id]?.y || startY;
                        const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                        svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash} />`;
                    } else {
                        currentY = losersOffsetY + (matchIndex * (boxHeight + gapY) * 2);
                    }
                } else {
                    currentY = losersOffsetY + (matchIndex * (boxHeight + gapY) * 2);
                }
                
                // Check if EITHER player dropped from the sky, and isn't a Phantom
                // In Minor rounds, player2 is always the drop. In First Round, either could be
                const isRealDrop = !match.isGhost && (
                    (match.player2 && !match.player2.isPhantom) || 
                    (isFirstRound && match.player1 && !match.player1.isPhantom)
                );

                if (isRealDrop) {
                    // Vertical Drop
                    svgLayer.innerHTML += `<path d="M ${currentX - (gapX/2)} ${currentY - 100} L ${currentX - (gapX/2)} ${currentY + (boxHeight/2)}" stroke="#f38ba8" stroke-width="2" stroke-dasharray="5,5" fill="none" />`;
                    
                    // Horizontal L-Connector (For First Round or if the horizontal parent was a Phantom)
                    if (isFirstRound || isParentPhantom) {
                        svgLayer.innerHTML += `<path d="M ${currentX - (gapX/2)} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#f38ba8" stroke-width="2" stroke-dasharray="5,5" fill="none" />`;
                    }
                }
            } else {
                const parent1 = prevLosers[matchIndex * 2];
                const parent2 = prevLosers[(matchIndex * 2) + 1];
                
                const p1Y = (parent1 && !parent1.winner?.isPhantom) ? matchCoordinates[parent1.id]?.y : undefined;
                const p2Y = (parent2 && !parent2.winner?.isPhantom) ? matchCoordinates[parent2.id]?.y : p1Y; 

                currentY = p1Y !== undefined && p2Y !== undefined ? (p1Y + p2Y) / 2 : losersOffsetY;

                if (p1Y !== undefined && p2Y !== undefined && p1Y !== p2Y) {
                    const midX = (currentX - gapX) + (gapX / 2);
                    const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                    svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${midX} ${p1Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash}/>`;
                    svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p2Y + (boxHeight/2)} L ${midX} ${p2Y + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash}/>`;
                } else if (p1Y !== undefined) {
                    const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                    svgLayer.innerHTML += `<path d="M ${currentX - gapX} ${p1Y + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#45475a" stroke-width="2" fill="none" ${dash}/>`;
                }
            }

            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage, tournament));
        });

        // GRAND FINALS
        gfMatches.forEach((match) => {
            // If tournament over, don't draw ghost reset
            if (stage.data.isComplete && match.isGhost) return;
            let currentY = 0;
            if (match.bracketReset) {
                const gf1 = visualRounds[roundIndex - 1]?.find(m => m.bracket === "grand_finals");
                currentY = gf1 ? matchCoordinates[gf1.id]?.y : startY;
                if (gf1) {
                    const prevX = matchCoordinates[gf1.id].x;
                    const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                    svgLayer.innerHTML += `<path d="M ${prevX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#f9e2af" stroke-width="3" fill="none" ${dash} />`;
                }
            } else {
                const wFinals = visualRounds.flat().reverse().find(m => m.bracket === "winners");
                const lFinals = visualRounds.flat().reverse().find(m => m.bracket === "losers");
                const wY = wFinals ? matchCoordinates[wFinals.id]?.y : startY;
                const lY = lFinals ? matchCoordinates[lFinals.id]?.y : losersOffsetY;
                currentY = (wY + lY) / 2;

                if (wFinals && lFinals) {
                    const wX = matchCoordinates[wFinals.id].x;
                    const lX = matchCoordinates[lFinals.id].x;
                    const midX = currentX - (gapX / 2);
                    const dash = match.isGhost ? 'stroke-dasharray="5,5"' : '';
                    svgLayer.innerHTML += `<path d="M ${wX} ${wY + (boxHeight/2)} L ${midX} ${wY + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#a6e3a1" stroke-width="3" fill="none" ${dash} />`;
                    svgLayer.innerHTML += `<path d="M ${lX} ${lY + (boxHeight/2)} L ${midX} ${lY + (boxHeight/2)} L ${midX} ${currentY + (boxHeight/2)} L ${currentX} ${currentY + (boxHeight/2)}" stroke="#f38ba8" stroke-width="3" fill="none" ${dash} />`;
                }
            }
            matchCoordinates[match.id] = { x: currentX + boxWidth, y: currentY };
            board.appendChild(createMatchBoxHTML(match, currentX, currentY, boxWidth, boxHeight, isActiveStage, tournament));
        });
    }
    applyPanAndZoom(document.getElementById('bracket-viewport'), board);
}


// HTML GENERATOR
function createMatchBoxHTML(match, x, y, width, height, isActiveStage, tournament) {
    const matchBox = document.createElement('div');
    
    if (match.winner && match.winner.isPhantom) {
        matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; visibility:hidden;`;
        return matchBox;
    }

    // HIDE BYES. We do NOT hide ghosts, because people want to see the empty structure!
    if (tournament.settings.hideByes && !match.isGhost && match.isBye) {
        matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; visibility:hidden;`;
        return matchBox;
    }
    
    matchBox.className = 'match-box';
    matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; padding:8px; box-sizing:border-box;`;
    
    if (match.isGhost) {
        matchBox.style.opacity = "0.3";
        matchBox.style.border = "1px dashed #45475a";
        matchBox.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; height:100%; color:gray; font-style:italic;"><div>TBD</div><div style="margin-top:10px;">TBD</div></div>`;
        return matchBox;
    }

    let borderColor = '#45475a'; 
    if (match.winner) borderColor = '#a6e3a1'; 
    else if (!isActiveStage) borderColor = '#f38ba8'; 
    matchBox.style.borderLeft = `4px solid ${borderColor}`; 

    const p1Name = match.player1 ? match.player1.name : "TBD";
    const p2Name = match.player2 ? match.player2.name : "TBD";
    let p1Disp = (match.winner?.id === match.player1?.id || match.winner === "tie") ? `<strong>${p1Name}</strong>` : p1Name;
    let p2Disp = (match.winner?.id === match.player2?.id || match.winner === "tie") ? `<strong>${p2Name}</strong>` : p2Name;

    // Cleaned up the bracket labels so they don't hover awkwardly!
    let bracketLabel = "";
    let statusText = match.isThirdPlaceMatch ? '3rd' : (match.isBye ? 'Auto' : (match.winner ? 'Done' : ''));
    if (match.bracket === "winners") bracketLabel = `<span style="color:#a6e3a1;">[W]</span>`;
    if (match.bracket === "losers") bracketLabel = `<span style="color:#f38ba8;">[L]</span>`;
    if (match.bracket === "grand_finals") bracketLabel = `<span style="color:#f9e2af;">${match.bracketReset ? '[RESET]' : '[GF]'}</span>`;

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
                    <small style="color:gray; font-size:10px; margin-bottom:5px;">${bracketLabel} ${statusText}</small>
                    ${!match.isBye ? `<button class="btn-edit-match" data-matchid="${match.id}" style="padding:4px 8px; font-size:10px; background:#f9e2af; color:#1e1e2e; border:none; border-radius:3px; cursor:pointer;">Edit</button>` : ''}
                </div>
            </div>`;
    } else if (isActiveStage) {
        matchBox.innerHTML = `
            <div style="display:flex; height:100%; align-items:center; position: relative;">
                <small style="position: absolute; top: -5px; right: 0; font-size: 10px;">${bracketLabel}</small>
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
            </div>`;
    } else {
        matchBox.innerHTML = `
            <div style="position:absolute; top: 5px; right: 5px; font-size: 10px;">${bracketLabel}</div>
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

import { calculateTiebreakers } from '../engine/systems/tiebreakers.js';
import { simulatePreview } from '../engine/formats/registry.js';
import { getIcon } from './icons.js';

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
            <div class="drag-handle" style="color: var(--accent); font-size: 16px; font-weight: bold; cursor: grab; padding: 5px; flex-shrink: 0;">⋮⋮</div>
            
            <!-- This container GROWS to fill all available space! -->
            <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; min-width: 0;">
                <strong title="${player.name}" style="color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <!-- ONLY THE NUMBER GOES IN THIS SPAN! -->
                    <span class="seed-number" style="color: var(--text-muted); margin-right: 5px;">${player.seed}</span>. ${player.name}
                </strong>
                <span style="font-size: 12px; color: var(--text-muted); flex-shrink: 0;">(ELO: ${player.elo})</span>
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
    let lastHoverCheck = 0;

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

        // 1.5 Cap the collision detection to ~60fps
        if (e.timeStamp - lastHoverCheck > 16) {
            lastHoverCheck = e.timeStamp;
            
            const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
            const hoveredCard = elementsUnderMouse.find(el => el.classList.contains('player-card') && !el.classList.contains('is-dragging'));
            
            if (hoveredCard && hoveredCard !== placeholder) {
                const hoverRect = hoveredCard.getBoundingClientRect();
                const hoverMiddleY = hoverRect.top + (hoverRect.height / 2);
                
                if (e.clientY < hoverMiddleY) container.insertBefore(placeholder, hoveredCard);
                else container.insertBefore(placeholder, hoveredCard.nextSibling);
            }
        }
        
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
    
    let tabsHtml = `<div class="stage-tabs-container" style="display:flex; gap:10px; margin-bottom: 20px; border-bottom: 2px solid var(--border-main); padding-bottom: 10px;">`;
    tournament.stages.forEach((stage, index) => {
        const isSelected = index === viewIndex;
        tabsHtml += `<button class="btn-stage-tab" data-index="${index}" style="background: ${isSelected ? 'var(--accent)' : 'transparent'}; color: ${isSelected ? 'var(--bg-dark)' : 'var(--text-main)'}; border: 1px solid var(--accent); padding: 5px 15px; cursor: pointer; font-weight: bold;">Stage ${index + 1}: ${stage.config.type.replace('_', ' ').toUpperCase()}</button>`;
    });
    tabsHtml += `</div>`;

    // Check current state to draw the correct button immediately
    const isStreamerMode = document.body.classList.contains('streamer-mode');
    const eyeIcon = isStreamerMode ? getIcon('closedEye', 20) : getIcon('openEye', 20);
    const eyeBg = isStreamerMode ? 'var(--danger)' : 'var(--bg-panel)';
    const eyeColor = isStreamerMode ? 'var(--text-on-accent)' : 'var(--text-main)';

    let html = `
        ${tabsHtml}
        <div class="stage-header-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2>Stage ${stageToRender.stageNumber}: ${stageToRender.config.type.replace('_', ' ').toUpperCase()} ${stageToRender.status === "completed" ? '<span style="color: gray; font-size: 14px;">(Completed)</span>' : ''}</h2>
            ${isActiveStage ? `<button id="btn-force-end-stage" style="background: var(--danger); color: var(--text-on-accent); border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">Force End Stage Early</button>` : ''}
        </div>
        
        <!-- THE NEW VIEWPORT (With the SVG Eye Button inside!) -->
        <div id="bracket-viewport" style="width: 100%; height: 70vh; overflow: hidden; background: var(--bg-bracket); border: 2px solid var(--border-main); border-radius: 8px; position: relative; cursor: grab;">
            
            <button id="btn-streamer-mode" title="Toggle Streamer Mode" style="position: absolute; top: 10px; right: 10px; z-index: 100; background: ${eyeBg}; color: ${eyeColor}; border: 1px solid var(--border-main); width: 36px; height: 36px; border-radius: 4px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s;">
                ${eyeIcon}
            </button>
            
            <!-- We will draw the boxes and lines inside this board -->
            <div id="bracket-board" style="position: absolute; top: 0; left: 0; transform-origin: 0 0; contain: layout style;">
                <svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // --- THE MATH ENGINE FOR DRAWING THE BRACKET ---
    drawBracketMath(stageToRender, isActiveStage, tournament);
}


function drawBracketMath(stage, isActiveStage, tournament) {
    const board = document.getElementById('bracket-board');
    board.innerHTML = '<svg id="bracket-lines" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>';
    const svgLayer = document.getElementById('bracket-lines');
    
    // --- READ DYNAMIC SIZES FROM CSS ---
   const rootStyles = getComputedStyle(document.documentElement);
    const boxWidth = parseInt(rootStyles.getPropertyValue('--box-width')) || 280; 
    const boxHeight = parseInt(rootStyles.getPropertyValue('--box-height')) || 95;
    const gapX = parseInt(rootStyles.getPropertyValue('--gap-x')) || 60;  
    const gapY = parseInt(rootStyles.getPropertyValue('--gap-y')) || 20;  
    
    const startX = 50; 
    const startY = 60;

    const matchDataMap = {}; 
    const showFull = tournament.settings.showFullBracket;
    const hideByes = tournament.settings.hideByes;

    // Performance Variables
    let svgPaths = [];
    let maxX = 0;
    let maxY = 0;

    // --- 1. THE SIMULATOR MERGER ---
    let visualRounds = [];
    if (showFull && (stage.config.type === "single_elimination" || stage.config.type === "double_elimination")) {
        const combinedConfig = { ...tournament.settings, ...stage.config };
        const simulatedRounds = simulatePreview(stage.data, combinedConfig);
        simulatedRounds.forEach((simRound, rIndex) => {
            if (stage.data.rounds[rIndex]) visualRounds.push(stage.data.rounds[rIndex]);
            else visualRounds.push(simRound);
        });
    } else if (showFull) {
        visualRounds = [...stage.data.rounds];
        const max = stage.config.maxRounds || stage.data.totalRounds || stage.data.rounds.length;
        while (visualRounds.length < max) {
            visualRounds.push(stage.data.rounds[0].map((m, i) => ({ id: `ghost-${visualRounds.length}-${i}`, isGhost: true })));
        }
    } else {
        visualRounds = stage.data.rounds;
    }

    const totalRoundsToDraw = visualRounds.length;

    // CALCULATE LOSERS BRACKET OFFSET
    let losersOffsetY = startY; 
    if (stage.config.type === "double_elimination") {
        const wR1Count = visualRounds[0].filter(m => m.bracket === "winners" || !m.bracket).length;
        losersOffsetY = startY + (wR1Count * (boxHeight + gapY)) + 150; 
    }

    // --- 2. PASS ONE: CALCULATE COORDINATES & DRAW BOXES ---
    for (let roundIndex = 0; roundIndex < totalRoundsToDraw; roundIndex++) {
        if (stage.data.isComplete && !visualRounds[roundIndex]) break; 

        const currentX = startX + (roundIndex * (boxWidth + gapX));
        const header = document.createElement('h3');
        header.innerText = `Round ${roundIndex + 1}`;
        header.style.cssText = `position:absolute; left:${currentX}px; top:10px; width:${boxWidth}px; text-align:center; margin:0; color: var(--text-main);`;
        board.appendChild(header);

        let matchesToDraw = visualRounds[roundIndex] || [];
        // Ensure real rounds don't accidentally contain ghosts
        if (roundIndex < stage.data.rounds.length) matchesToDraw = matchesToDraw.filter(m => !m.isGhost);

        // This guarantees that 'hideByes: true' never leaves an ugly gap at the top of the screen
        if (stage.config.type !== "single_elimination" && stage.config.type !== "double_elimination") {
            matchesToDraw.sort((a, b) => {
                if (a.isBye && !b.isBye) return 1;  // Push 'a' down
                if (!a.isBye && b.isBye) return -1; // Push 'b' down
                return 0; // Keep original order if both are byes or neither are byes
            });
        }
        
        const wMatches = matchesToDraw.filter(m => m.bracket === "winners" || m.bracket === undefined);
        const lMatches = matchesToDraw.filter(m => m.bracket === "losers");
        const gfMatches = matchesToDraw.filter(m => m.bracket === "grand_finals");

        // WINNERS
        wMatches.forEach((match, matchIndex) => {
            let centerY = 0;
            if ((stage.config.type === "single_elimination" || stage.config.type === "double_elimination") && roundIndex > 0) {
                if (match.isThirdPlaceMatch) {
                    const actualRound = visualRounds[roundIndex];
                    let finalsY = startY;
                    if (actualRound && actualRound[0]) {
                        finalsY = matchDataMap[actualRound[0].id]?.centerY || startY;
                    }
                    centerY = finalsY + 140;

                } else {
                    const prevRound = visualRounds[roundIndex - 1] || [];
                    const parent1 = prevRound.filter(m => m.bracket === match.bracket || !m.bracket)[matchIndex * 2];
                    const parent2 = prevRound.filter(m => m.bracket === match.bracket || !m.bracket)[(matchIndex * 2) + 1];
                    const p1Y = parent1 ? matchDataMap[parent1.id]?.centerY : undefined;
                    const p2Y = parent2 ? matchDataMap[parent2.id]?.centerY : undefined;
                    centerY = p1Y !== undefined && p2Y !== undefined ? (p1Y + p2Y) / 2 : (p1Y !== undefined ? p1Y : startY);
                }
            } else {
                const multiplier = (stage.config.type === "single_elimination" || stage.config.type === "double_elimination") ? Math.pow(2, roundIndex) : 1;
                centerY = startY + (matchIndex * (boxHeight + gapY) * multiplier) + (boxHeight / 2);
            }
            saveBox(match, currentX, centerY);
        });

        // LOSERS
        lMatches.forEach((match, matchIndex) => {
            let centerY = 0;
            const prevRound = visualRounds[roundIndex - 1] || [];
            const prevLosers = prevRound.filter(m => m.bracket === "losers");

            if (prevLosers.length === 0) {
                centerY = losersOffsetY + (matchIndex * (boxHeight + gapY) * 2) + (boxHeight / 2);
            } else if (prevLosers.length === lMatches.length) {
                const parent = prevLosers[matchIndex];
                centerY = parent ? matchDataMap[parent.id]?.centerY : losersOffsetY + (matchIndex * (boxHeight + gapY) * 2) + (boxHeight / 2);
            } else {
                const parent1 = prevLosers[matchIndex * 2];
                const parent2 = prevLosers[(matchIndex * 2) + 1];
                const p1Y = parent1 ? matchDataMap[parent1.id]?.centerY : undefined;
                const p2Y = parent2 ? matchDataMap[parent2.id]?.centerY : undefined;
                centerY = p1Y !== undefined && p2Y !== undefined ? (p1Y + p2Y) / 2 : (p1Y !== undefined ? p1Y : losersOffsetY);
            }
            saveBox(match, currentX, centerY);
        });

        // GRAND FINALS
        gfMatches.forEach((match) => {
            if (stage.data.isComplete && match.isGhost) return;
            let centerY = 0;
            if (match.bracketReset) {
                const gf1 = visualRounds[roundIndex - 1]?.find(m => m.bracket === "grand_finals");
                centerY = gf1 ? matchDataMap[gf1.id]?.centerY : startY;
            } else {
                const wFinals = visualRounds.flat().reverse().find(m => m.bracket === "winners");
                const lFinals = visualRounds.flat().reverse().find(m => m.bracket === "losers");
                const wY = wFinals ? matchDataMap[wFinals.id]?.centerY : startY;
                const lY = lFinals ? matchDataMap[lFinals.id]?.centerY : losersOffsetY;
                centerY = (wY + lY) / 2;
            }
            saveBox(match, currentX, centerY);
        });
    }

    function saveBox(match, leftX, centerY) {
        const isPhantom = match.winner && match.winner.isPhantom;
        const isSimOrGhost = match.isSimulated || match.isGhost;
        const isHiddenBye = hideByes && !isSimOrGhost && match.isBye;
        const isVisible = !isPhantom && !isHiddenBye;

        maxX = Math.max(maxX, leftX + boxWidth);
        maxY = Math.max(maxY, centerY + (boxHeight / 2));
        
        matchDataMap[match.id] = { match, leftX, rightX: leftX + boxWidth, centerY, isVisible, isSimOrGhost };
        board.appendChild(createMatchBoxHTML(match, leftX, centerY - (boxHeight/2), boxWidth, boxHeight, isActiveStage, tournament));
    }


    // --- 3. PASS TWO: SVG SMART ROUTING ---
    if (stage.config.type === "single_elimination" || stage.config.type === "double_elimination") {
        Object.values(matchDataMap).forEach(childData => {
            if (!childData.isVisible) return;
    
            if (childData.match.isThirdPlaceMatch) return;
    
            // Player 1 Routing
            if (childData.match.player1 && !childData.match.player1.isPhantom) {
                const p1Parent = findVisualParent(childData.match, childData.match.player1.id);
                if (p1Parent) {
                    drawRoute(p1Parent, childData);
                } else if (childData.match.bracket === "losers" && isDropRound(childData.match)) {
                    // Failsafe: If no parent found but it's a drop round (like L-R1 ghosts), draw pink drop!
                    drawDropLine(childData);
                }
            }
            
            // Player 2 Routing
            if (childData.match.player2 && !childData.match.player2.isPhantom) {
                const p2Parent = findVisualParent(childData.match, childData.match.player2.id);
                if (p2Parent) {
                    drawRoute(p2Parent, childData);
                } else if (childData.match.bracket === "losers" && isDropRound(childData.match)) {
                    drawDropLine(childData);
                }
            }
        });
    }

    // Helper to determine if a Losers match accepts drops from the sky
    function isDropRound(match) {
        if (match.bracket !== "losers") return false;
        const roundIndex = match.round - 1;
        const prevRound = visualRounds[roundIndex - 1];
        if (!prevRound) return true; // L-R1
        const prevLosers = prevRound.filter(m => m.bracket === "losers");
        const currLosers = visualRounds[roundIndex].filter(m => m.bracket === "losers");
        return prevLosers.length === currLosers.length || prevLosers.length === 0;
    }

    // Recursive back-track: Finds the last VISIBLE match a player was in!
    function findVisualParent(currentMatch, playerId) {
        // Find all past matches for this player
        const pastMatches = visualRounds.flat().filter(m => 
            m.round < currentMatch.round && (m.player1?.id === playerId || m.player2?.id === playerId)
        );
        
        // BASE CASE: No past matches exist! They spawned in this round.
        if (pastMatches.length === 0) return null;

        // Get the very last match they played before this one
        const immediateParent = pastMatches[pastMatches.length - 1];
        const pData = matchDataMap[immediateParent.id];
        
        if (!pData) return null;
        
        // SUCCESS: The parent is visible on the screen! Connect to it!
        if (pData.isVisible) return pData; 
        
        // RECURSION: The parent is invisible (Hidden Bye). Keep searching backwards!
        // FIXED: Pass `immediateParent` directly, NOT `immediateParent.match`!
        return findVisualParent(immediateParent, playerId); 
    }

    // Draws the perfect path based on brackets
    function drawRoute(parentData, childData) {
        const isDrop = parentData.match.bracket === "winners" && childData.match.bracket === "losers";
        
        if (isDrop) {
            if (parentData.match.round === childData.match.round - 1) {
                drawDropLine(childData);
            }
            return;
        }

        const px = parentData.rightX;
        const py = parentData.centerY;
        const cx = childData.leftX;
        const cy = childData.centerY;
        
        const dash = (parentData.isSimOrGhost || childData.isSimOrGhost) ? 'stroke-dasharray="5,5"' : '';
        let color = "var(--border-main)"; 
        
        if (childData.match.bracketReset) color = "var(--warning)"; 
        else if (childData.match.bracket === "grand_finals" && parentData.match.bracket === "winners") color = "var(--success)"; 
        else if (childData.match.bracket === "grand_finals" && parentData.match.bracket === "losers") color = "var(--danger)"; 

        if (py === cy) {
            svgPaths.push(`<path d="M ${px} ${py} L ${cx} ${cy}" stroke="${color}" stroke-width="2" fill="none" ${dash} />`);
        } else {
            const midX = cx - (gapX / 2);
            svgPaths.push(`<path d="M ${px} ${py} L ${midX} ${py} L ${midX} ${cy} L ${cx} ${cy}" stroke="${color}" stroke-width="2" fill="none" ${dash} />`);
        }
    }

    // Draws the Pink Drop Line
    function drawDropLine(childData) {
        const cx = childData.leftX;
        const cy = childData.centerY;
        const dash = childData.isSimOrGhost ? 'stroke-dasharray="5,5"' : '';
        svgPaths.push(`<path d="M ${cx - (gapX/2)} ${cy - 80} L ${cx - (gapX/2)} ${cy} L ${cx} ${cy}" stroke="var(--danger)" stroke-width="2" fill="none" ${dash} />`);
    }

    svgLayer.innerHTML = svgPaths.join('');

    board.style.width = `${maxX + 200}px`;
    board.style.height = `${maxY + 200}px`;
    svgLayer.style.width = `${maxX + 200}px`;
    svgLayer.style.height = `${maxY + 200}px`;

    applyPanAndZoom(document.getElementById('bracket-viewport'), board);
}

// --- HTML BOX GENERATOR ---
function createMatchBoxHTML(match, x, y, width, height, isActiveStage, tournament) {
    const matchBox = document.createElement('div');
    
    // HIDDEN BOXES (Phantoms and Hidden Byes)
    if ((match.winner && match.winner.isPhantom) || (tournament.settings.hideByes && !match.isSimulated && !match.isGhost && match.isBye)) {
        matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; visibility:hidden;`;
        return matchBox;
    }

    matchBox.className = 'match-box';
    matchBox.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${width}px; height:${height}px; padding:8px; box-sizing:border-box;`;
    
    // GHOSTS (Simulated Previews)
    if (match.isSimulated || match.isGhost) {
        matchBox.style.opacity = "0.3";
        matchBox.style.border = "1px dashed var(--border-main)";
        matchBox.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; height:100%; color:var(--text-muted); font-style:italic;"><div>TBD</div><div style="margin-top:10px;">TBD</div></div>`;
        return matchBox;
    }

    // Border Color Logic
    let borderColor = match.winner ? 'var(--success)' : (!isActiveStage ? 'var(--danger)' : 'var(--border-main)'); 
    matchBox.style.borderLeft = `4px solid ${borderColor}`; 

    const p1 = match.player1;
    const p2 = match.player2;
    const p1Name = p1 ? p1.name : "TBD";
    const p2Name = p2 ? p2.name : "TBD";
    
    // Highlight winner text in green
    const p1Color = (match.winner?.id === p1?.id) ? 'var(--success)' : 'var(--text-main)';
    const p2Color = (match.winner?.id === p2?.id) ? 'var(--success)' : 'var(--text-main)';

    // Bracket Tags [W], [L], [GF]
    let bracketLabel = "";
    if (match.bracket === "winners") bracketLabel = `<span style="color:var(--success);">[W]</span>`;
    if (match.bracket === "losers") bracketLabel = `<span style="color:var(--danger);">[L]</span>`;
    if (match.bracket === "grand_finals") bracketLabel = `<span style="color:var(--warning);">${match.bracketReset ? '[RESET]' : '[GF]'}</span>`;

    // Seed Generation
    const showSeeds = tournament.settings.showSeeds;
    const p1SeedStr = showSeeds ? `<span style="width:24px; flex-shrink:0; color:var(--text-muted); font-size:10px; text-align:left;" title="Seed: ${p1?.originalSeed || p1?.seed || '-'}">[${p1?.originalSeed || p1?.seed || '-'}]</span>` : '';
    const p2SeedStr = showSeeds ? `<span style="width:24px; flex-shrink:0; color:var(--text-muted); font-size:10px; text-align:left;" title="Seed: ${p2?.originalSeed || p2?.seed || '-'}">[${p2?.originalSeed || p2?.seed || '-'}]</span>` : '';

    // DPW Delta Generation
    const p1WinStr = match.dpwDeltas ? `<span style="color:var(--success); font-size:10px; margin-left:4px; flex-shrink:0;" title="Rating gained if they win">(+${match.dpwDeltas.p1Win})</span>` : '';
    const p2WinStr = match.dpwDeltas ? `<span style="color:var(--success); font-size:10px; margin-left:4px; flex-shrink:0;" title="Rating gained if they win">(+${match.dpwDeltas.p2Win})</span>` : '';
    
    let tieDisplay = isActiveStage ? "Ties:" : "";
    if (match.dpwDeltas) {
        const tieSign = match.dpwDeltas.tieRaw > 0 ? '+' : (match.dpwDeltas.tieRaw < 0 ? '-' : '±');
        tieDisplay = `Tie: <span style="color:${match.dpwDeltas.tieRaw > 0 ? 'var(--success)' : 'var(--danger)'};">${tieSign}${match.dpwDeltas.tieMag}</span>`;
    }

    // SVG Icons
    const iconSubmit = `<svg style="pointer-events: none; transform: scale(1.4);" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const iconEdit = `<svg style="pointer-events: none; transform: scale(1.25);" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    
    // --- RENDER LOGIC ---
    // --- RENDER LOGIC ---
    if (match.winner || match.isBye) {
        // COMPLETED STATE
        let statusText = match.isThirdPlaceMatch ? '3rd Place' : (match.isBye ? 'Auto-Bye' : 'Completed');
        
        matchBox.innerHTML = `
            <small style="position: absolute; top: 2px; right: 4px; font-size: 10px;">${bracketLabel}</small>
            <div class="match-box-content">
                
                <div class="match-player-row">
                    ${p1SeedStr}
                    <div class="match-player-name" title="${p1Name}" style="color:${p1Color}; font-weight:${match.winner?.id === p1?.id ? 'bold' : 'normal'};">${p1Name}</div>
                    <div class="match-score">${match.score1}</div>
                </div>

                <div class="match-player-row">
                    ${p2SeedStr}
                    <div class="match-player-name" title="${p2Name}" style="color:${p2Color}; font-weight:${match.winner?.id === p2?.id ? 'bold' : 'normal'};">${p2Name}</div>
                    <div class="match-score">${match.score2}</div>
                </div>

                <div class="match-info-row">
                    <span>${statusText}</span>
                    <span>${match.draws ? `${match.draws} Ties` : ''}</span>
                </div>

                ${!match.isBye ? `<button class="btn-match-action btn-edit-match" data-matchid="${match.id}" title="Edit Match" style="background:var(--warning); color:var(--bg-dark);">${iconEdit}</button>` : ''}
            </div>
        `;

    } else if (isActiveStage) {
        // ACTIVE STATE
        matchBox.innerHTML = `
            <small style="position: absolute; top: 2px; right: 4px; font-size: 10px;">${bracketLabel}</small>
            <div class="match-box-content">
                
                <div class="match-player-row">
                    ${p1SeedStr}
                    <div class="match-player-name" title="${p1Name}">${p1Name}</div>
                    ${p1WinStr}
                    <input type="number" id="s1-${match.id}" class="match-score-input" value="${match.score1}">
                </div>

                <div class="match-player-row">
                    ${p2SeedStr}
                    <div class="match-player-name" title="${p2Name}">${p2Name}</div>
                    ${p2WinStr}
                    <input type="number" id="s2-${match.id}" class="match-score-input" value="${match.score2}">
                </div>

                <div class="match-info-row">
                    <span>${tieDisplay}</span>
                    <input type="number" id="d-${match.id}" title="Ties/Draws" class="match-score-input" style="width:50px; height:18px; font-size:10px; margin-left:0;" value="${match.draws || 0}">
                </div>

                <button class="btn-match-action btn-report" data-matchid="${match.id}" title="Submit Score" style="background:var(--success); color:var(--bg-dark);">${iconSubmit}</button>
            </div>
        `;
        
    } else {
        // FUTURE STATE (Pending)
        matchBox.innerHTML = `
            <div style="position:absolute; top:5px; right: 5px; font-size:10px;">${bracketLabel}</div>
            <div style="display:flex; flex-direction:column; justify-content:center; gap:5px; height:100%;">
                <div title="${p1Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p1SeedStr}${p1Name}</div>
                <div title="${p2Name}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p2SeedStr}${p2Name}</div>
                <small style="color:var(--text-muted);">Pending</small>
            </div>
        `;
    }
    
    return matchBox;
}



// Global object to remember camera position across redraws!
window.bracketCamera = window.bracketCamera || { x: 0, y: 0, scale: 1 };

export function applyPanAndZoom(viewport, board) {
    let panning = false, startX = 0, startY = 0;

    function setTransform() {
        board.style.transform = `translate(${window.bracketCamera.x}px, ${window.bracketCamera.y}px) scale(${window.bracketCamera.scale})`;
        /*
        // --- HYBRID RENDERING TRICK (deprecated)---
        // If zoomed in (> 1.0), remove the GPU lock so text renders as crisp vectors.
        // If zoomed out (<= 1.0), apply the GPU lock so massive brackets don't lag when panning.
        if (window.bracketCamera.scale > 1.0) {
            board.style.willChange = 'auto'; 
        } else {
            board.style.willChange = 'transform';
        } */
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
    
    // NEW: Check if we are viewing a DPW Swiss stage
    const isDPW = tournament.stages.length > 0 && tournament.stages[viewIndex].config.type === "dpw_swiss";
    const pointsLabel = isDPW ? "Rating" : "Points";

    let stageTiebreakers = tournament.settings.tiebreakers; 
    if (tournament.stages.length > 0 && tournament.stages[viewIndex].config.tiebreakers) {
        stageTiebreakers = tournament.stages[viewIndex].config.tiebreakers;
    }

    const sortedPlayers = [...tournament.players].sort((a, b) => sortFunction(a, b, stageTiebreakers));

    let html = `
        <h2 style="margin-top: 40px; border-top: 1px solid var(--border-main); padding-top: 20px;">Current Standings</h2>
        <table style="width: 100%; border-collapse: collapse; text-align: left; background: var(--bg-panel);">
            <thead>
                <tr style="border-bottom: 2px solid var(--accent);">
                    <th style="padding: 10px;">Rank</th>
                    <th style="padding: 10px;">Name</th>
                    <th style="padding: 10px;">${pointsLabel}</th>
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

        const displayPoints = isDPW ? (player.stats.dpwRating ?? 1000) : player.stats.points;

        html += `
            <tr style="border-bottom: 1px solid var(--border-main);">
                <td style="padding: 10px;"><b>${currentDisplayRank}</b></td>
                <td style="padding: 10px; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${player.name}">${player.name}</td>
                <td style="padding: 10px; font-weight: bold; color: var(--accent);">${displayPoints}</td>
                <td style="padding: 10px;">${player.stats.matchWins}-${player.stats.matchLosses}-${player.stats.matchDraws}</td>
                <td style="padding: 10px;">${player.stats.gameWins}-${player.stats.gameLosses}-${player.stats.gameDraws}</td>
                <td style="padding: 10px;">${player.stats.buchholz}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

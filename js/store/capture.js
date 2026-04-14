import { layoutState } from '../ui/renderer.js';

// Truncates long names specifically for SVG text rendering
function trimName(name, maxLength = 13) {
    if (!name) return "TBD";
    return name.length > maxLength ? name.substring(0, maxLength) + "..." : name;
}

export function exportBracketSVG(tournamentName) {
    if (!layoutState.stage) return;

    // 1. Grab current CSS Theme variables from the BODY (so it catches .theme-arcade and .layout-classic)
    const rs = getComputedStyle(document.body);
    
    const boxWidth = parseInt(rs.getPropertyValue('--box-width')) || 280;
    const boxHeight = parseInt(rs.getPropertyValue('--box-height')) || 95;
    const gapX = parseInt(rs.getPropertyValue('--gap-x')) || 60;
    
    // Check if the Classic Layout is active to remove border-radius
    const isClassic = document.body.classList.contains('layout-classic');
    const rx = isClassic ? 0 : 4; // Sharp corners for classic!

    const colors = {
        bgBracket: rs.getPropertyValue('--bg-bracket').trim() || '#080808',
        bgPanel: rs.getPropertyValue('--bg-panel').trim() || '#1f1f1f',
        textMain: rs.getPropertyValue('--text-main').trim() || '#e0e0e0',
        textMuted: rs.getPropertyValue('--text-muted').trim() || '#808080',
        borderMain: rs.getPropertyValue('--border-main').trim() || '#333333',
        success: rs.getPropertyValue('--success').trim() || '#c238b3',
        danger: rs.getPropertyValue('--danger').trim() || '#d97a26',
        warning: rs.getPropertyValue('--warning').trim() || '#d4a017'
    };

    // 2. Build the internal stylesheet
    const svgStyles = `
        :root {
            --bg-bracket: ${colors.bgBracket}; --bg-panel: ${colors.bgPanel};
            --text-main: ${colors.textMain}; --text-muted: ${colors.textMuted};
            --border-main: ${colors.borderMain}; --success: ${colors.success};
            --danger: ${colors.danger}; --warning: ${colors.warning};
        }
        text { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    `;

    // 3. Draw Round Headers mathematically
    let headersHTML = "";
    for (let r = 0; r < layoutState.rounds; r++) {
        const xPos = 50 + (r * (boxWidth + gapX)) + (boxWidth / 2);
        headersHTML += `<text x="${xPos}" y="30" fill="var(--text-main)" font-size="18" font-weight="bold" text-anchor="middle">Round ${r + 1}</text>`;
    }
    
    // 4. Draw Match Boxes
    let boxesHTML = "";
    Object.values(layoutState.matchDataMap).forEach(data => {
        if (!data.isVisible) return;

        const m = data.match;
        const topY = data.centerY - (boxHeight / 2);
        const isGhost = m.isSimulated || m.isGhost;

        // Base Box
        const dash = isGhost ? 'stroke-dasharray="5,5"' : '';
        const opacity = isGhost ? '0.3' : (isClassic ? '0' : '1'); // Transparent background in Classic mode
        
        boxesHTML += `<rect x="${data.leftX}" y="${topY}" width="${boxWidth}" height="${boxHeight}" fill="var(--bg-panel)" fill-opacity="${opacity}" stroke="var(--border-main)" stroke-width="2" rx="${rx}" ${dash} />`;

        if (isGhost) {
            boxesHTML += `<text x="${data.leftX + boxWidth/2}" y="${data.centerY}" fill="var(--text-muted)" font-size="14" font-style="italic" text-anchor="middle" dominant-baseline="middle">TBD</text>`;
            return;
        }

        // Left Border Accent
        const borderColor = m.winner ? 'var(--success)' : (!layoutState.isActive ? 'var(--danger)' : 'var(--border-main)');
        boxesHTML += `<rect x="${data.leftX}" y="${topY}" width="4" height="${boxHeight}" fill="${borderColor}" rx="${rx===0 ? 0 : 2}" />`;

        // Bracket Label (Moved INSIDE the top-right corner)
        let bLabel = ""; let bColor = "var(--text-muted)";
        if (m.bracket === "winners") { bLabel = "[W]"; bColor = "var(--success)"; }
        if (m.bracket === "losers") { bLabel = "[L]"; bColor = "var(--danger)"; }
        if (m.bracket === "grand_finals") { bLabel = m.bracketReset ? "[RESET]" : "[GF]"; bColor = "var(--warning)"; }
        
        if (bLabel !== "") {
            boxesHTML += `<text x="${data.leftX + boxWidth - 8}" y="${topY + 14}" fill="${bColor}" font-size="10" text-anchor="end">${bLabel}</text>`;
        }

        // Player Text Logic
        let p1Name = m.player1 ? trimName(m.player1.name, 13) : "TBD";
        let p2Name = m.player2 ? trimName(m.player2.name, 13) : "TBD";
        // Add the seed to the start of the string if it exists
        if (m.player1 && m.player1.originalSeed) p1Name = `[${m.player1.originalSeed}] ${p1Name}`;
        if (m.player2 && m.player2.originalSeed) p2Name = `[${m.player2.originalSeed}] ${p2Name}`;
        
        const p1Color = m.winner?.id === m.player1?.id ? 'var(--success)' : 'var(--text-main)';
        const p2Color = m.winner?.id === m.player2?.id ? 'var(--success)' : 'var(--text-main)';
        const p1Weight = m.winner?.id === m.player1?.id ? 'bold' : 'normal';
        const p2Weight = m.winner?.id === m.player2?.id ? 'bold' : 'normal';

        // P1 & P2 Text
        const p1Y = topY + (isClassic ? 23 : 32);
        const p2Y = topY + (isClassic ? 47 : 62);
        const bottomY = topY + boxHeight - 8; // Pins to the bottom safely

        // Player 1 Row
        boxesHTML += `<text x="${data.leftX + 15}" y="${p1Y}" fill="${p1Color}" font-size="14" font-weight="${p1Weight}" dominant-baseline="middle">${p1Name}</text>`;
        boxesHTML += `<text x="${data.leftX + boxWidth - 15}" y="${p1Y}" fill="var(--text-main)" font-size="14" font-weight="bold" text-anchor="end" dominant-baseline="middle">${m.score1}</text>`;
        
        // Player 2 Row
        boxesHTML += `<text x="${data.leftX + 15}" y="${p2Y}" fill="${p2Color}" font-size="14" font-weight="${p2Weight}" dominant-baseline="middle">${p2Name}</text>`;
        boxesHTML += `<text x="${data.leftX + boxWidth - 15}" y="${p2Y}" fill="var(--text-main)" font-size="14" font-weight="bold" text-anchor="end" dominant-baseline="middle">${m.score2}</text>`;
        
        // Status and Ties Row
        let statusText = m.isThirdPlaceMatch ? '3rd Place' : (m.isBye ? 'Auto-Bye' : (m.winner ? 'Completed' : 'Pending'));
        boxesHTML += `<text x="${data.leftX + 15}" y="${bottomY}" fill="var(--text-muted)" font-size="10">${statusText}</text>`;
        
        if (m.draws && m.draws > 0) {
            boxesHTML += `<text x="${data.leftX + boxWidth - 15}" y="${bottomY}" fill="var(--text-muted)" font-size="10" text-anchor="end">${m.draws} Ties</text>`;
        }
    });

    // 5. Construct Final SVG String
    const finalSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layoutState.width} ${layoutState.height}" width="${layoutState.width}" height="${layoutState.height}">
            <style>${svgStyles}</style>
            <rect width="100%" height="100%" fill="var(--bg-bracket)" />
            <g id="lines">${layoutState.paths}</g>
            <g id="headers">${headersHTML}</g>
            <g id="boxes">${boxesHTML}</g>
        </svg>
    `;

    // 6. Download
    const blob = new Blob([finalSVG.trim()], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeName = tournamentName.replace(/[^a-zA-Z0-9-_]/g, '_') || "Tournament";
    a.download = `${safeName}_Bracket.svg`;
    a.click();
}

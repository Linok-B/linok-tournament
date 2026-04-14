import { layoutState } from '../ui/renderer.js';

export function exportBracketSVG(tournamentName) {
    if (!layoutState.stage) return;

    // 1. Grab current CSS Theme variables from the DOM
    const rs = getComputedStyle(document.documentElement);
    const boxWidth = parseInt(rs.getPropertyValue('--box-width')) || 280;
    const boxHeight = parseInt(rs.getPropertyValue('--box-height')) || 95;
    const gapX = parseInt(rs.getPropertyValue('--gap-x')) || 60;
    
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

    // 2. Build the internal stylesheet (so the SVG works offline)
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
        boxesHTML += `<rect x="${data.leftX}" y="${topY}" width="${boxWidth}" height="${boxHeight}" fill="var(--bg-panel)" stroke="var(--border-main)" stroke-width="2" rx="4" ${isGhost ? 'stroke-dasharray="5,5" fill-opacity="0.3"' : ''} />`;

        if (isGhost) {
            boxesHTML += `<text x="${data.leftX + boxWidth/2}" y="${data.centerY}" fill="var(--text-muted)" font-size="14" font-style="italic" text-anchor="middle">TBD</text>`;
            return;
        }

        // Left Border Accent
        const borderColor = m.winner ? 'var(--success)' : (!layoutState.isActive ? 'var(--danger)' : 'var(--border-main)');
        boxesHTML += `<rect x="${data.leftX}" y="${topY}" width="4" height="${boxHeight}" fill="${borderColor}" rx="2" />`;

        // Bracket Label
        let bLabel = ""; let bColor = "var(--text-muted)";
        if (m.bracket === "winners") { bLabel = "[W]"; bColor = "var(--success)"; }
        if (m.bracket === "losers") { bLabel = "[L]"; bColor = "var(--danger)"; }
        if (m.bracket === "grand_finals") { bLabel = m.bracketReset ? "[RESET]" : "[GF]"; bColor = "var(--warning)"; }
        boxesHTML += `<text x="${data.leftX + boxWidth - 5}" y="${topY - 5}" fill="${bColor}" font-size="10" text-anchor="end">${bLabel}</text>`;

        // Player Text Logic
        const p1Name = m.player1 ? (m.player1.originalSeed ? `[${m.player1.originalSeed}] ${m.player1.name}` : m.player1.name) : "TBD";
        const p2Name = m.player2 ? (m.player2.originalSeed ? `[${m.player2.originalSeed}] ${m.player2.name}` : m.player2.name) : "TBD";
        const p1Color = m.winner?.id === m.player1?.id ? 'var(--success)' : 'var(--text-main)';
        const p2Color = m.winner?.id === m.player2?.id ? 'var(--success)' : 'var(--text-main)';
        const p1Weight = m.winner?.id === m.player1?.id ? 'bold' : 'normal';
        const p2Weight = m.winner?.id === m.player2?.id ? 'bold' : 'normal';

        // P1 & P2 Text (Y offsets calculated based on standard box height)
        const p1Y = topY + (boxHeight * 0.35);
        const p2Y = topY + (boxHeight * 0.70);

        boxesHTML += `<text x="${data.leftX + 15}" y="${p1Y}" fill="${p1Color}" font-size="14" font-weight="${p1Weight}">${p1Name}</text>`;
        boxesHTML += `<text x="${data.leftX + boxWidth - 10}" y="${p1Y}" fill="var(--text-main)" font-size="14" font-weight="bold" text-anchor="end">${m.score1}</text>`;
        
        boxesHTML += `<text x="${data.leftX + 15}" y="${p2Y}" fill="${p2Color}" font-size="14" font-weight="${p2Weight}">${p2Name}</text>`;
        boxesHTML += `<text x="${data.leftX + boxWidth - 10}" y="${p2Y}" fill="var(--text-main)" font-size="14" font-weight="bold" text-anchor="end">${m.score2}</text>`;
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

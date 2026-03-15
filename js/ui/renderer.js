export function renderPlayerList(players, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 
    if (players.length === 0) return;

    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
    sortedPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `<strong>${player.name}</strong><span>ELO: ${player.elo}</span>`;
        container.appendChild(card);
    });
}

// NEW: Render the generated bracket data
export function renderBracket(tournament, containerId) {
    const container = document.getElementById(containerId);
    
    // If we haven't started, just show players
    if (tournament.status === "setup" || tournament.stages.length === 0) {
        container.innerHTML = '<h2>Registered Players</h2><div id="players-list"></div>';
        renderPlayerList(tournament.players, 'players-list');
        return;
    }

    // If we have started, show the active stage
    const activeStage = tournament.stages[tournament.stages.length - 1];
    const matches = activeStage.data.rounds[0]; // Get Round 1

    container.innerHTML = `<h2>Stage ${activeStage.stageNumber}: Single Elimination (Round 1)</h2>`;
    
    const bracketDiv = document.createElement('div');
    bracketDiv.style.display = 'flex';
    bracketDiv.style.flexDirection = 'column';
    bracketDiv.style.gap = '10px';

    matches.forEach(match => {
        const matchBox = document.createElement('div');
        matchBox.style.background = 'rgba(0,0,0,0.3)';
        matchBox.style.padding = '10px';
        matchBox.style.borderRadius = '5px';
        matchBox.style.borderLeft = '4px solid #f38ba8';

        const p1Name = match.player1 ? match.player1.name : "TBD";
        const p2Name = match.player2 ? match.player2.name : "BYE";

        matchBox.innerHTML = `
            <div><strong>${p1Name}</strong> vs <strong>${p2Name}</strong></div>
            <small style="color: gray;">Match ID: ${match.id} ${match.isBye ? '(Auto-Advance)' : ''}</small>
        `;
        bracketDiv.appendChild(matchBox);
    });

    container.appendChild(bracketDiv);
}

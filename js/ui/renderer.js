// js/ui/renderer.js

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

export function renderBracket(tournament, containerId) {
    const container = document.getElementById(containerId);
    
    if (tournament.status === "setup" || tournament.stages.length === 0) {
        container.innerHTML = '<h2>Setup: Add Players</h2><div id="players-list"></div>';
        // ASSUMES you kept the renderPlayerList function from previous step!
        // If not, let me know.
        container.innerHTML += `<p>Total: ${tournament.players.length}</p>`;
        return;
    }

    const activeStage = tournament.stages[tournament.stages.length - 1];
    
    // Create a horizontal scrolling container for the bracket
    container.innerHTML = `
        <h2>Stage ${activeStage.stageNumber}: Single Elimination</h2>
        ${tournament.status === "completed" ? '<h3 style="color:#a6e3a1;">Tournament Complete!</h3>' : ''}
        <div id="bracket-board" style="display:flex; gap:30px; overflow-x:auto; padding-bottom:20px;"></div>
    `;

    const board = document.getElementById('bracket-board');

    // Loop through all rounds and draw them as columns
    activeStage.data.rounds.forEach((roundMatches, roundIndex) => {
        const roundColumn = document.createElement('div');
        roundColumn.style.minWidth = '250px';
        roundColumn.innerHTML = `<h3>Round ${roundIndex + 1}</h3>`;

        roundMatches.forEach(match => {
            const matchBox = document.createElement('div');
            matchBox.style.background = 'rgba(0,0,0,0.3)';
            matchBox.style.padding = '10px';
            matchBox.style.marginBottom = '10px';
            matchBox.style.borderRadius = '5px';
            
            // Visual indicator if finished
            if (match.winner) {
                matchBox.style.borderLeft = '4px solid #a6e3a1'; // Green
            } else {
                matchBox.style.borderLeft = '4px solid #f38ba8'; // Red
            }

            const p1Name = match.player1 ? match.player1.name : "TBD";
            const p2Name = match.player2 ? match.player2.name : "TBD";

            // If match is finished OR is a Bye, just show the names and winner
            if (match.winner || match.isBye) {
                matchBox.innerHTML = `
                    <div style="${match.winner?.id === match.player1?.id ? 'font-weight:bold;color:#a6e3a1;' : ''}">${p1Name} ${match.winner ? `(${match.score1})` : ''}</div>
                    <div style="${match.winner?.id === match.player2?.id ? 'font-weight:bold;color:#a6e3a1;' : ''}">${p2Name} ${match.winner ? `(${match.score2})` : ''}</div>
                    <small style="color:gray;">${match.isBye ? 'Auto-Advance' : 'Completed'}</small>
                `;
            } else {
                // Match is active, show inputs
                matchBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span>${p1Name}</span>
                        <input type="number" id="s1-${match.id}" style="width:40px; padding:2px;" value="0">
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span>${p2Name}</span>
                        <input type="number" id="s2-${match.id}" style="width:40px; padding:2px;" value="0">
                    </div>
                    <button class="btn-report" data-matchid="${match.id}" style="width:100%; padding:5px; font-size:12px;">Submit Score</button>
                `;
            }
            roundColumn.appendChild(matchBox);
        });
        board.appendChild(roundColumn);
    });
}

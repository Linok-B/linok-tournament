// Updates the player list on the screen
export function renderPlayerList(players, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear current display

    if (players.length === 0) {
        container.innerHTML = '<p>No players added yet.</p>';
        return;
    }

    // Sort players by ELO before rendering
    const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

    sortedPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <strong>${player.name}</strong>
            <span>ELO: ${player.elo}</span>
        `;
        container.appendChild(card);
    });
}

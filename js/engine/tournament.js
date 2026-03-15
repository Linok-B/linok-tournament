// THE MASTER DATA STRUCTURE
export class Tournament {
    constructor() {
        this.players = [];
        this.stages = [];
        this.settings = {
            name: "My Custom Tournament",
            format: "hybrid"
        };
    }

    addPlayer(name, startingElo) {
        const newPlayer = {
            id: crypto.randomUUID(), // Built-in browser function for unique IDs
            name: name,
            elo: parseInt(startingElo),
            isActive: true,
            stats: { wins: 0, losses: 0, draws: 0 }
        };
        this.players.push(newPlayer);
        return newPlayer;
    }

    // We will build this out later for Swiss/Elimination
    getTopPlayersByElo(count) {
        return [...this.players].sort((a, b) => b.elo - a.elo).slice(0, count);
    }
}

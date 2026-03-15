import { generateSingleElimination } from './formats/elimination.js';

export class Tournament {
    constructor() {
        this.players = [];
        this.stages = [];
        this.status = "setup"; // setup, active, completed
        this.settings = { name: "My Custom Tournament" };
    }

    addPlayer(name, startingElo) {
        if (this.status !== "setup") return null; // Can't add players after start
        
        const newPlayer = {
            id: crypto.randomUUID(),
            name: name,
            elo: parseInt(startingElo),
        };
        this.players.push(newPlayer);
        return newPlayer;
    }

    // Moves from Setup to Phase 1
    startSingleElimination() {
        if (this.players.length < 2) {
            alert("Need at least 2 players!");
            return false;
        }

        // Generate the bracket data
        const stageData = generateSingleElimination(this.players);
        
        // Add it to pipeline
        this.stages.push({
            stageNumber: this.stages.length + 1,
            data: stageData
        });

        this.status = "active";
        return true;
    }
}

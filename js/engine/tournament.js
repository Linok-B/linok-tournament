import { generateSingleElimination, generateNextRound } from './formats/elimination.js';

export class Tournament {
    constructor() {
        this.players = [];
        this.stages = [];
        this.status = "setup"; 
        this.settings = { name: "My Custom Tournament" };
    }

    // ... KEEP your existing addPlayer and startSingleElimination functions ...
    addPlayer(name, startingElo) {
        if (this.status !== "setup") return null; 
        const newPlayer = { id: crypto.randomUUID(), name: name, elo: parseInt(startingElo) };
        this.players.push(newPlayer);
        return newPlayer;
    }

    startSingleElimination() {
        if (this.players.length < 2) return false;
        const stageData = generateSingleElimination(this.players);
        // NEW: Resolve any Round 1 Byes immediately so they are ready for Round 2
        stageData.rounds[0].forEach(match => {
            if (match.isBye) match.winner = match.player1;
        });
        this.stages.push({ stageNumber: this.stages.length + 1, data: stageData });
        this.status = "active";
        return true;
    }

    // NEW FUNCTION: Report a score and progress the bracket
    reportMatchScore(matchId, score1, score2) {
        if (this.status !== "active") return false;

        const activeStage = this.stages[this.stages.length - 1];
        const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];

        // Find the specific match
        const match = currentRound.find(m => m.id === matchId);
        if (!match || match.winner) return false; // Can't edit finished match (yet)

        match.score1 = parseInt(score1) || 0;
        match.score2 = parseInt(score2) || 0;

        // Determine winner
        if (match.score1 > match.score2) match.winner = match.player1;
        else if (match.score2 > match.score1) match.winner = match.player2;
        else return false; // No ties in basic elimination!

        // Check if the whole round is finished
        const isRoundComplete = currentRound.every(m => m.winner !== null);
        
        if (isRoundComplete) {
            if (currentRound.length > 1) {
                // Not the finals! Generate next round.
                const nextRoundNum = activeStage.data.rounds.length + 1;
                const nextRoundMatches = generateNextRound(currentRound, nextRoundNum);
                
                // Auto-resolve any new Byes
                nextRoundMatches.forEach(m => { if (m.isBye) m.winner = m.player1; });
                
                activeStage.data.rounds.push(nextRoundMatches);
            } else {
                // It was the finals!
                this.status = "completed";
            }
        }
        return true;
    }
}

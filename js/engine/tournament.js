import { getFormat } from './formats/registry.js';

export class Tournament {
    constructor() {
        this.players = [];
        this.stages = [];
        this.status = "setup"; 
        
        // We will test Round Robin with a custom variable of maxRounds: 3
        this.settings = { 
            name: "My Custom Tournament",
            pipeline: [
                { type: "round_robin", maxRounds: 3 }
            ]
        };
    }

    addPlayer(name, startingElo) {
        if (this.status !== "setup") return null; 
        
        const newPlayer = { 
            id: crypto.randomUUID(), 
            name: name, 
            elo: parseInt(startingElo) || 1200, 
            seed: this.players.length + 1, 
            
            // FUTURE PROOFING: A place to inject JSON team data, unit weights, or custom flags later
            metadata: {
                teamScore: 0,
                units: [] 
            },

            stats: {
                matchWins: 0, matchLosses: 0, matchDraws: 0,
                gameWins: 0, gameLosses: 0,
                points: 0      
            }
        };
        this.players.push(newPlayer);
        return newPlayer;
    }

    removePlayer(playerId) {
        if (this.status !== "setup") return false; // Can only remove during setup
        this.players = this.players.filter(p => p.id !== playerId);
        
        // Re-adjust seeds so they stay sequential (1, 2, 3...)
        this.players.forEach((p, index) => p.seed = index + 1);
        return true;
    }

    startTournament() {
        if (this.players.length < 2 || this.settings.pipeline.length === 0) return false;
        this.status = "active";
        this.transitionToNextStage(this.players);
        return true;
    }

    transitionToNextStage(incomingPlayers) {
        const nextStageIndex = this.stages.length;
        const config = this.settings.pipeline[nextStageIndex];

        if (!config) {
            this.status = "completed";
            return;
        }

        // DYNAMIC ROUTING: Ask the registry for the format math
        const formatEngine = getFormat(config.type);
        const stageData = formatEngine.initStage(incomingPlayers, config);

        this.stages.push({
            stageNumber: nextStageIndex + 1,
            config: config,
            data: stageData,
            status: "active"
        });
    }

    reportMatchScore(matchId, score1, score2) {
        if (this.status !== "active") return false;

        const activeStage = this.stages[this.stages.length - 1];
        const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
        const match = currentRound.find(m => m.id === matchId);
        
        if (!match || match.winner) return false;

        match.score1 = parseInt(score1) || 0;
        match.score2 = parseInt(score2) || 0;

        // Allow ties in Round Robin!

        if (match.score1 > match.score2) match.winner = match.player1;
        else if (match.score2 > match.score1) match.winner = match.player2;
        else match.winner = "tie"; 

        // NEW: Update Player Stats based on the result!
        // We will pull the global settings for points, or use defaults
        const ptsForWin = this.settings.pointsForWin !== undefined ? this.settings.pointsForWin : 3;
        const ptsForDraw = this.settings.pointsForDraw !== undefined ? this.settings.pointsForDraw : 1;
        
        // Find the actual player objects in the master list
        const p1 = this.players.find(p => p.id === match.player1.id);
        const p2 = this.players.find(p => p.id === match.player2.id);

        if (p1 && p2) {
            p1.stats.gameWins += match.score1;
            p1.stats.gameLosses += match.score2;
            p2.stats.gameWins += match.score2;
            p2.stats.gameLosses += match.score1;

            if (match.winner === match.player1) {
                p1.stats.matchWins++;
                p1.stats.points += ptsForWin;
                p2.stats.matchLosses++;
            } else if (match.winner === match.player2) {
                p2.stats.matchWins++;
                p2.stats.points += ptsForWin;
                p1.stats.matchLosses++;
            } else if (match.winner === "tie") {
                p1.stats.matchDraws++;
                p2.stats.matchDraws++;
                p1.stats.points += ptsForDraw;
                p2.stats.points += ptsForDraw;
            }
        }
        return true;
    }
}

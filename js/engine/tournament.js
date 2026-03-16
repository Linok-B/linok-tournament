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
        else match.winner = "tie"; // Special keyword for tie

        const isRoundComplete = currentRound.every(m => m.winner !== null);
        
        if (isRoundComplete) {
            // DYNAMIC ADVANCEMENT
            const formatEngine = getFormat(activeStage.config.type);
            activeStage.data = formatEngine.advanceStage(activeStage.data, activeStage.config);

            if (activeStage.data.isComplete) {
                activeStage.status = "completed";
                // If there are more stages in pipeline, trigger transition here later
                if (this.stages.length >= this.settings.pipeline.length) {
                    this.status = "completed";
                }
            }
        }
        return true;
    }
}

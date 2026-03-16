import { generateSingleElimination } from './formats/elimination.js';

export class Tournament {
    constructor() {
        this.players = [];
        this.stages = []; // Stores the active/completed match data
        this.status = "setup"; 
        
        // THE BLUEPRINT: The host defines this before starting
        this.settings = { 
            name: "My Custom Tournament",
            pipeline: [
                // Right now we only have Single Elim built, but later we will add:
                // { type: "swiss", rounds: 4 },
                { type: "single_elimination" } 
            ]
        };
    }

    addPlayer(name, startingElo) {
        if (this.status !== "setup") return null; 
        const newPlayer = { id: crypto.randomUUID(), name: name, elo: parseInt(startingElo) };
        this.players.push(newPlayer);
        return newPlayer;
    }

    // NEW: Generic Start Function
    startTournament() {
        if (this.players.length < 2) return false;
        if (this.settings.pipeline.length === 0) return false;

        this.status = "active";
        
        // Start the first stage in the pipeline
        this.transitionToNextStage(this.players);
        return true;
    }

    // THE PIPELINE MANAGER
    transitionToNextStage(incomingPlayers) {
        const nextStageIndex = this.stages.length;
        const stageConfig = this.settings.pipeline[nextStageIndex];

        if (!stageConfig) {
            this.status = "completed";
            return;
        }

        let stageData = null;

        // Route to the correct mathematical generator
        if (stageConfig.type === "single_elimination") {
            stageData = generateSingleElimination(incomingPlayers);
            // Resolve Byes
            stageData.rounds[0].forEach(match => {
                if (match.isBye) match.winner = match.player1;
            });
        }
        // else if (stageConfig.type === "swiss") { ... }

        this.stages.push({
            stageNumber: nextStageIndex + 1,
            config: stageConfig,
            data: stageData,
            status: "active"
        });
    }

    // UPDATED: Report Score (Kept mostly the same, but isolated logic to active stage)
    reportMatchScore(matchId, score1, score2) {
        if (this.status !== "active") return false;

        const activeStage = this.stages[this.stages.length - 1];
        const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
        const match = currentRound.find(m => m.id === matchId);
        
        if (!match || match.winner) return false;

        match.score1 = parseInt(score1) || 0;
        match.score2 = parseInt(score2) || 0;

        if (match.score1 > match.score2) match.winner = match.player1;
        else if (match.score2 > match.score1) match.winner = match.player2;
        else return false; 

        const isRoundComplete = currentRound.every(m => m.winner !== null);
        
        if (isRoundComplete) {
            // Check if stage is complete
            if (activeStage.config.type === "single_elimination") {
                if (currentRound.length > 1) {
                    // Import generateNextRound inside the function or file scope
                    // (Ensure generateNextRound is imported at the top of this file!)
                    this._progressEliminationRound(activeStage, currentRound);
                } else {
                    activeStage.status = "completed";
                    // If there's another stage in the pipeline, we would trigger transition here.
                    // For now, if pipeline is done, finish tournament.
                    if (this.stages.length >= this.settings.pipeline.length) {
                        this.status = "completed";
                    }
                }
            }
        }
        return true;
    }

    // Helper to keep code clean
    _progressEliminationRound(activeStage, currentRound) {
        import('./formats/elimination.js').then(module => {
            const nextRoundNum = activeStage.data.rounds.length + 1;
            const nextRoundMatches = module.generateNextRound(currentRound, nextRoundNum);
            nextRoundMatches.forEach(m => { if (m.isBye) m.winner = m.player1; });
            activeStage.data.rounds.push(nextRoundMatches);
        });
    }
}

import { getFormat } from './formats/registry.js';

export class Tournament {

    constructor() {
        this.players = [];
        this.stages = [];
        this.status = "setup"; 
        
        this.settings = { 
            name: "My Custom Tournament",
            pointsForWin: 3,
            pointsForDraw: 1,
            pointsForLoss: 0,
            
            // Default to just Single Elim
            pipeline: [
                { type: "single_elimination" } 
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

        let playersForNextStage = [...incomingPlayers];

        // THE BRIDGE: Top Cut Logic
        if (config.cutToTop && config.cutToTop < playersForNextStage.length) {
            playersForNextStage.sort((a, b) => {
                const ptsA = a.stats?.points ?? 0;
                const ptsB = b.stats?.points ?? 0;
                if (ptsB !== ptsA) return ptsB - ptsA; 
                
                const aDiff = (a.stats?.gameWins ?? 0) - (a.stats?.gameLosses ?? 0);
                const bDiff = (b.stats?.gameWins ?? 0) - (b.stats?.gameLosses ?? 0);
                return bDiff - aDiff;
            });

            playersForNextStage = playersForNextStage.slice(0, config.cutToTop);

            playersForNextStage.forEach((p, index) => {
                p.seed = index + 1;
            });
        }

        // SYNCHRONOUS GENERATION
        const formatEngine = getFormat(config.type);
        const stageData = formatEngine.initStage(playersForNextStage, config);

        this.stages.push({
            id: crypto.randomUUID(), // Add a unique ID to the stage for historical viewing later!
            stageNumber: nextStageIndex + 1,
            config: config,
            data: stageData,
            status: "active"
        });
    }

    // In js/engine/tournament.js

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
        else match.winner = "tie"; 

        // 1. Recalculate stats from scratch!
        this.recalculateAllStats();

        // 2. Check if round is finished
        const isRoundComplete = currentRound.every(m => m.winner !== null);
        
        if (isRoundComplete) {
            import('./formats/registry.js').then(({ getFormat }) => {
                const formatEngine = getFormat(activeStage.config.type);
                activeStage.data = formatEngine.advanceStage(activeStage.data, activeStage.config, this.players);

                if (activeStage.data.isComplete) {
                    activeStage.status = "completed";
                    if (this.stages.length >= this.settings.pipeline.length) {
                        this.status = "completed";
                    } else {
                        // Instead of auto-transitioning, we just unlock the next stage button in the UI (We will build this later)
                        // For now, we leave it as is, waiting for the host.
                        this.transitionToNextStage(this.players);
                    }
                }
                
                import('../store/localData.js').then(({ saveTournamentLocally }) => {
                    saveTournamentLocally(this);
                    document.getElementById('btn-add-player').dispatchEvent(new Event('stateChanged'));
                });
            });
        }
        return true;
    }

    // NEW: Bulletproof Leaderboard Recalculation
    recalculateAllStats() {
        // Reset everyone to zero
        this.players.forEach(p => {
            p.stats = { matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0, points: 0 };
        });

        const ptsForWin = this.settings.pointsForWin !== undefined ? this.settings.pointsForWin : 3;
        const ptsForDraw = this.settings.pointsForDraw !== undefined ? this.settings.pointsForDraw : 1;
        const ptsForLoss = this.settings.pointsForLoss !== undefined ? this.settings.pointsForLoss : 0;

        // Tally up every completed match
        this.stages.forEach(stage => {
            stage.data.rounds.forEach(round => {
                round.forEach(match => {
                    if (!match.winner) return;

                    const p1 = this.players.find(p => p.id === match.player1?.id);
                    const p2 = this.players.find(p => p.id === match.player2?.id);

                    if (match.isBye && p1) {
                        p1.stats.matchWins++;
                        p1.stats.points += ptsForWin;
                        return;
                    }

                    if (p1 && p2) {
                        p1.stats.gameWins += match.score1; p1.stats.gameLosses += match.score2;
                        p2.stats.gameWins += match.score2; p2.stats.gameLosses += match.score1;

                        if (match.winner.id === p1.id) {
                            p1.stats.matchWins++; p1.stats.points += ptsForWin; p2.stats.matchLosses++; p2.stats.points += ptsForLoss;
                        } else if (match.winner.id === p2.id) {
                            p2.stats.matchWins++; p2.stats.points += ptsForWin; p1.stats.matchLosses++; p1.stats.points += ptsForLoss;
                        } else if (match.winner === "tie") {
                            p1.stats.matchDraws++; p2.stats.matchDraws++;
                            p1.stats.points += ptsForDraw; p2.stats.points += ptsForDraw;
                        }
                    }
                });
            });
        });
    }

    // NEW: The Time Machine (Undo/Edit Match)
    undoMatch(matchId, forceDestructive = false) {
        let foundStageIndex = -1;
        let foundRoundIndex = -1;
        let targetMatch = null;

        // Find exactly where this match lives
        for (let s = 0; s < this.stages.length; s++) {
            for (let r = 0; r < this.stages[s].data.rounds.length; r++) {
                const m = this.stages[s].data.rounds[r].find(x => x.id === matchId);
                if (m) {
                    foundStageIndex = s; foundRoundIndex = r; targetMatch = m;
                    break;
                }
            }
        }

        if (!targetMatch || !targetMatch.winner) return { success: false, reason: "Match not found or already active." };

        const stage = this.stages[foundStageIndex];
        const isLatestRound = (foundRoundIndex === stage.data.rounds.length - 1) && (foundStageIndex === this.stages.length - 1);

        // If it's an old round and we haven't confirmed destruction, abort and warn the UI
        if (!isLatestRound && !forceDestructive) {
            return { success: false, requiresConfirmation: true };
        }

        // DESTRUCTIVE ACTION: Delete all stages that came AFTER this stage
        this.stages = this.stages.slice(0, foundStageIndex + 1);
        
        // DESTRUCTIVE ACTION: Delete all rounds that came AFTER this round
        stage.data.rounds = stage.data.rounds.slice(0, foundRoundIndex + 1);

        // Reset the match
        targetMatch.winner = null;
        targetMatch.score1 = 0;
        targetMatch.score2 = 0;

        // Reactivate the tournament
        stage.status = "active";
        stage.data.isComplete = false;
        this.status = "active";

        this.recalculateAllStats();
        return { success: true };
    }
}

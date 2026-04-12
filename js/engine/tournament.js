import { getFormat } from './formats/registry.js';
import { calculateTiebreakers } from './systems/tiebreakers.js';

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

            randomizeSeeds: false,
            playThirdPlaceMatch: false,
            showFullBracket: false,
            hideByes: false,

            // Default waterfal (Host can change this later)
            tiebreakers: ["game_differential", "head_to_head", "buchholz", "seed"], 

            
            // Default to just Single Elim
            pipeline: [
                { type: "single_elimination" }
            ],

            // UI STATE
            ui: {
                theme: "modern",
                layout: "modern",
                customColors: {
                    bgDark: "#1e1e2e",
                    bgPanel: "#2a2a3e",
                    bgBracket: "#11111b",
                    accent: "#89b4fa",
                    success: "#a6e3a1",
                    danger: "#f38ba8"
                }
            }
        };
    }

    addPlayer(name, startingElo) {
        if (this.status !== "setup") return null; 
        
        const newPlayer = { 
            id: crypto.randomUUID(), 
            name: name, 
            elo: parseInt(startingElo) || 1200, 
            seed: this.players.length + 1, 
            originalSeed: this.players.length + 1,
            
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

    // In js/engine/tournament.js - Update startTournament()

    startTournament() {
        if (this.players.length < 2 || this.settings.pipeline.length === 0) return false;
        
        // Execute Randomize Seeds
        if (this.settings.randomizeSeeds) {
            // Fisher-Yates Shuffle Algorithm
            for (let i = this.players.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.players[i], this.players[j]] = [this.players[j], this.players[i]];
            }
            
            // Re-assign the official seed numbers based on the new random physical order
            this.players.forEach((p, index) => {
                p.seed = index + 1;
            });
        }
        
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

        // RULE: Only revive if a Top Cut is explicitly defined
        if (config.cutToTop !== undefined && config.cutToTop !== null && config.cutToTop > 0) {
            
            let pastStageTiebreakers = this.settings.tiebreakers;
            if (this.stages.length > 0 && this.stages[this.stages.length - 1].config.tiebreakers) {
                pastStageTiebreakers = this.stages[this.stages.length - 1].config.tiebreakers;
            }

            // Sort EVERYONE by standings (including the dead)
            const sortFunction = calculateTiebreakers(this.players, this.stages);
            playersForNextStage.sort((a, b) => sortFunction(a, b, pastStageTiebreakers));
            
            // Slice the Top N (if N > length, slice returns everyone)
            playersForNextStage = playersForNextStage.slice(0, config.cutToTop);
            
            // REVIVE: These players made the cut, so they are alive for the next stage
            playersForNextStage.forEach((p, index) => { 
                p.isEliminated = false;
                p.seed = index + 1; 
            });
            
        } else {
            // No Top Cut? Only people who survived the previous stage (un-eliminated) move on
            playersForNextStage = playersForNextStage.filter(p => !p.isEliminated);
            
            // Re-seed survivors
            playersForNextStage.forEach((p, index) => { p.seed = index + 1; });
        }

        this.executeTransition(playersForNextStage, config, nextStageIndex);
    }

    executeTransition(playersForNextStage, config, nextStageIndex) {
        // Ensure format registry is loaded
        const formatEngine = getFormat(config.type);
        const stageData = formatEngine.initStage(playersForNextStage, config);

        this.stages.push({
            id: crypto.randomUUID(),
            stageNumber: nextStageIndex + 1,
            config: config,
            data: stageData,
            status: "active"
        });

        this.recalculateAllStats();

        // Trigger save and update
        import('../store/localData.js').then(({ saveTournamentLocally }) => {
            saveTournamentLocally(this);
            document.getElementById('btn-add-player').dispatchEvent(new Event('stateChanged'));
        });
    }

    reportMatchScore(matchId, score1, score2, draws = 0) {
        if (this.status !== "active") return false;

        const activeStage = this.stages[this.stages.length - 1];
        const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
        const match = currentRound.find(m => m.id === matchId);
        if (!match || match.winner) return false;

        match.score1 = parseInt(score1) || 0;
        match.score2 = parseInt(score2) || 0;
        match.draws = parseInt(draws) || 0;

        if ((activeStage.config.type === "single_elimination" || activeStage.config.type === "double_elimination") && match.score1 === match.score2) {
            alert("Ties are not allowed in Elimination formats!");
            return false; 
        }

        if (match.score1 > match.score2) match.winner = match.player1;
        else if (match.score2 > match.score1) match.winner = match.player2;
        else match.winner = "tie"; 

        this.recalculateAllStats();

        const isRoundComplete = currentRound.every(m => m.winner !== null);
        
        if (isRoundComplete) {
            const formatEngine = getFormat(activeStage.config.type);
            
            // Merge global settings into stage config so engines can see toggles like 3rd place match
            const combinedConfig = { 
                ...this.settings, 
                ...activeStage.config 
            };

            activeStage.data = formatEngine.advanceStage(activeStage.data, combinedConfig, this.players);

            this.recalculateAllStats();

            if (activeStage.data.isComplete) {
                activeStage.status = "completed";
                if (this.stages.length >= this.settings.pipeline.length) {
                    this.status = "completed";
                } else {
                    this.transitionToNextStage(this.players);
                }
            }
        }
        
        return true; 
    }

    
    recalculateAllStats() {
        // Reset everyone to zero AND revive everyone
        this.players.forEach(p => {
            p.isEliminated = false; 
            p.stats = { matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, points: 0, dpwRating: 1000, eliminationScore: 9999 };
        });

        const ptsForWin = this.settings.pointsForWin !== undefined ? this.settings.pointsForWin : 3;
        const ptsForDraw = this.settings.pointsForDraw !== undefined ? this.settings.pointsForDraw : 1;
        const ptsForLoss = this.settings.pointsForLoss !== undefined ? this.settings.pointsForLoss : 0;

        // Tally up every completed match
        this.stages.forEach(stage => {
            stage.data.rounds.forEach(round => {
                round.forEach(match => {

                    const p1 = this.players.find(p => p.id === match.player1?.id);
                    const p2 = this.players.find(p => p.id === match.player2?.id);

                    // --- PRE-CALCULATE DPW DELTAS FOR UI (Frozen in Time) ---
                    if (stage.config.type === "dpw_swiss" && p1 && p2 && !match.isBye) {
                        const p1TS = p1.metadata?.dpwTS ?? 0;
                        const p2TS = p2.metadata?.dpwTS ?? 0;
                        
                        const C_TS = Math.max(stage.config.C_TS ?? 1, 1);  
                        const C_R = 400;
                        const beta = stage.config.beta ?? 0.7;
                        
                        // Engine now just reads the explicitly saved values!
                        const K_base = stage.config.K_base ?? 20; 
                        const r_ramp = stage.config.r_ramp ?? 1;
                        const K_r = K_base * Math.min(1, match.round / r_ramp);  
                        
                        const D = beta * ((p1TS - p2TS) / C_TS) + (1 - beta) * ((p1.stats.dpwRating - p2.stats.dpwRating) / C_R);
                        const E_A = 1 / (1 + Math.pow(10, -D));

                        const getDelta = (S) => {
                            const raw = K_r * (S - E_A);
                            const mag = Math.abs(raw) >= 0.5 ? Math.max(1, Math.round(Math.abs(raw))) : 0;
                            return { raw, mag };
                        };

                        const winStats = getDelta(1);
                        const lossStats = getDelta(0);
                        const tieStats = getDelta(0.5);

                        match.dpwDeltas = {
                            p1Win: winStats.mag, 
                            p2Win: lossStats.mag, 
                            tieRaw: tieStats.raw, 
                            tieMag: tieStats.mag
                        };
                    }

                    if (!match.winner) return;

                    if (match.isBye && p1) {
                        p1.stats.matchWins++; p1.stats.points += ptsForWin;
                        return; // Byes don't affect rating, only standings points
                    }

                    if (p1 && p2) {
                        p1.stats.gameWins += match.score1; p1.stats.gameLosses += match.score2;
                        p2.stats.gameWins += match.score2; p2.stats.gameLosses += match.score1;

                        p1.stats.gameDraws += (match.draws || 0);
                        p2.stats.gameDraws += (match.draws || 0);

                        let loserObj = null;

                        if (match.winner.id === p1.id) {
                            p1.stats.matchWins++; p1.stats.points += ptsForWin; 
                            p2.stats.matchLosses++; p2.stats.points += ptsForLoss;
                            loserObj = p2;
                        } else if (match.winner.id === p2.id) {
                            p2.stats.matchWins++; p2.stats.points += ptsForWin; 
                            p1.stats.matchLosses++; p1.stats.points += ptsForLoss;
                            loserObj = p1;
                        } else if (match.winner === "tie") {
                            p1.stats.matchDraws++; p2.stats.matchDraws++;
                            p1.stats.points += ptsForDraw; p2.stats.points += ptsForDraw;
                        }

                        // --- APPLY DPW RATING ---
                        if (stage.config.type === "dpw_swiss" && match.dpwDeltas) {
                            let actualRaw = 0;
                            let actualMag = 0;

                            if (match.winner === "tie") {
                                actualRaw = match.dpwDeltas.tieRaw;
                                actualMag = match.dpwDeltas.tieMag;
                            } else if (match.winner.id === p1.id) {
                                actualRaw = 1; // P1 won
                                actualMag = match.dpwDeltas.p1Win;
                            } else {
                                actualRaw = -1; // P2 won
                                actualMag = match.dpwDeltas.p2Win;
                            }

                            if (actualMag > 0) {
                                if (actualRaw > 0) {
                                    p1.stats.dpwRating += actualMag;
                                    p2.stats.dpwRating -= actualMag;
                                } else if (actualRaw < 0) {
                                    p1.stats.dpwRating -= actualMag;
                                    p2.stats.dpwRating += actualMag;
                                }
                            }
                        }

                        // Iron-clad Elimination check!
                        // --- FGC PLACEMENT & ELIMINATION CHECK ---
                        if (loserObj) {
                            let isTrueElimination = false;

                            if (stage.config.type === "single_elimination") {
                                if (!match.isThirdPlaceMatch) isTrueElimination = true;
                            } else if (stage.config.type === "double_elimination") {
                                if (match.bracket === "losers") isTrueElimination = true;
                                if (match.bracket === "grand_finals") {
                                    // In GF1, if the Winners Champ loses, they just drop to GF2. Not eliminated yet!
                                    if (!match.bracketReset && loserObj.id === match.player1?.id) {
                                        isTrueElimination = false;
                                    } else {
                                        isTrueElimination = true;
                                    }
                                }
                            }

                            if (isTrueElimination) {
                                loserObj.isEliminated = true;
                                loserObj.stats.eliminationScore = match.round;
                            }

                            // Explicit placement logic for 3rd Place Match
                            // (Loser gets Round - 0.9, Winner gets Round - 0.5, perfectly putting them between Semis and GF)
                            if (stage.config.type === "single_elimination" && match.isThirdPlaceMatch) {
                                loserObj.stats.eliminationScore = match.round - 0.9; 
                                match.winner.stats.eliminationScore = match.round - 0.5;
                            }
                        }
                    }
                });
            });
        });
    }

    // Undo/Edit Match
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
        // targetMatch.score1 = 0; // Commented out just in case
        // targetMatch.score2 = 0; // Commented out just in case

        // Reactivate the tournament
        stage.status = "active";
        stage.data.isComplete = false;
        this.status = "active";

        this.recalculateAllStats();
        return { success: true };
    }
}

// js/engine/systems/tiebreakers.js

export function calculateTiebreakers(players, stagesConfig) {
    // 1. Calculate Buchholz scores for everyone first
    players.forEach(p => {
        p.stats.buchholz = 0;
        p.stats.opponents = [];
        
        // Scan past matches to find who they played
        stagesConfig.forEach(stage => {
            stage.data.rounds.forEach(round => {
                round.forEach(match => {
                    if (!match.winner || match.isBye) return;
                    
                    if (match.player1?.id === p.id) p.stats.opponents.push(match.player2?.id);
                    else if (match.player2?.id === p.id) p.stats.opponents.push(match.player1?.id);
                });
            });
        });
    });

    // Sum up the points of those opponents
    players.forEach(p => {
        p.stats.buchholz = p.stats.opponents.reduce((sum, oppId) => {
            const opp = players.find(x => x.id === oppId);
            return sum + (opp ? opp.stats.points : 0);
        }, 0);
    });

    // 2. Return the master Sorting Function that acts as the "Waterfall"
    return function sortPlayers(a, b, tiebreakerArray) {
        
        // BULLETPROOF FALLBACK: If tiebreakerArray is undefined/missing, use the default.
        const activeTiebreakers = tiebreakerArray || ["game_differential", "head_to_head", "buchholz", "seed"];

        // 0. Primary Sort: Match Points
        const ptsA = a.stats?.points ?? 0;
        const ptsB = b.stats?.points ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;

        // 1. Loop through the custom tiebreaker waterfall (Using the SAFE variable!)
        for (let rule of activeTiebreakers) {
            
            if (rule === "game_differential") {
                const aDiff = (a.stats?.gameWins ?? 0) - (a.stats?.gameLosses ?? 0);
                const bDiff = (b.stats?.gameWins ?? 0) - (b.stats?.gameLosses ?? 0);
                if (bDiff !== aDiff) return bDiff - aDiff;
            }
            
            if (rule === "buchholz") {
                const aBuch = a.stats?.buchholz ?? 0;
                const bBuch = b.stats?.buchholz ?? 0;
                if (bBuch !== aBuch) return bBuch - aBuch;
            }
            
            if (rule === "head_to_head") {
                let aBeatB = false;
                let bBeatA = false;
                
                stagesConfig.forEach(stage => {
                    stage.data.rounds.forEach(round => {
                        round.forEach(match => {
                            if (!match.winner || match.isBye) return;
                            
                            const p1id = match.player1?.id;
                            const p2id = match.player2?.id;
                            
                            if ((p1id === a.id && p2id === b.id) || (p1id === b.id && p2id === a.id)) {
                                if (match.winner.id === a.id) aBeatB = true;
                                if (match.winner.id === b.id) bBeatA = true;
                            }
                        });
                    });
                });
                
                if (aBeatB && !bBeatA) return -1; 
                if (bBeatA && !aBeatB) return 1;  
            }
            
            if (rule === "elo") {
                const aElo = a.elo ?? 0;
                const bElo = b.elo ?? 0;
                if (bElo !== aElo) return bElo - aElo;
            }
            
            if (rule === "seed") {
                const aSeed = a.seed ?? 999;
                const bSeed = b.seed ?? 999;
                if (aSeed !== bSeed) return aSeed - bSeed;
            }
        }

        return 0; // Exactly tied on every single metric
    };
}

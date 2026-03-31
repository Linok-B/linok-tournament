export function calculateTiebreakers(players, stagesConfig) {
    // 1. Gather all opponents for each player
    players.forEach(p => {
        p.stats.buchholz = 0;
        p.stats.median_buchholz = 0;
        p.stats.opponents = [];
        
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

    // 2. Calculate Both Buchholz and Median-Buchholz
    players.forEach(p => {
        // Get an array of all opponents' current points and sort them from lowest to highest
        const oppPoints = p.stats.opponents.map(oppId => {
            const opp = players.find(x => x.id === oppId);
            return opp ? opp.stats.points : 0;
        }).sort((a, b) => a - b);

        // Standard Buchholz (Sum of all)
        p.stats.buchholz = oppPoints.reduce((sum, val) => sum + val, 0);

        // Median Buchholz (Drop highest and lowest, requires at least 3 matches to work)
        if (oppPoints.length > 2) {
            p.stats.median_buchholz = oppPoints.slice(1, -1).reduce((sum, val) => sum + val, 0);
        } else {
            p.stats.median_buchholz = p.stats.buchholz; // Fallback to normal if not enough games
        }
    });

    // 3. Return the Sorting Waterfall
    return function sortPlayers(a, b, tiebreakerArray) {
        // Fallback for missing settings
        const activeTiebreakers = tiebreakerArray || ["game_differential", "head_to_head", "buchholz", "seed"];

        // 0. Primary Sort: Match Points
        const ptsA = a.stats?.points ?? 0;
        const ptsB = b.stats?.points ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;

        // 1. Loop through the custom tiebreaker waterfall
        for (let rule of activeTiebreakers) {
            
            if (rule === "game_differential") {
                const aDiff = (a.stats?.gameWins ?? 0) - (a.stats?.gameLosses ?? 0);
                const bDiff = (b.stats?.gameWins ?? 0) - (b.stats?.gameLosses ?? 0);
                if (bDiff !== aDiff) return bDiff - aDiff;
            }
            
            if (rule === "median_buchholz") {
                const aMed = a.stats?.median_buchholz ?? 0;
                const bMed = b.stats?.median_buchholz ?? 0;
                if (bMed !== aMed) return bMed - aMed;
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
            
            if (rule === "dpw_rating") {
                const aRat = a.stats?.dpwRating ?? 1000;
                const bRat = b.stats?.dpwRating ?? 1000;
                if (bRat !== aRat) return bRat - aRat;
            }
        } 

        return 0; // Exactly tied
    };
}

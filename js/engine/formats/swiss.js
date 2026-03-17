export function initStage(players, config) {
    // Round 1 of Swiss: Just pair them by seed (1v2, 3v4)
    const seededPlayers = [...players].sort((a, b) => a.seed - b.seed);
    const maxRounds = config.maxRounds || 3; 
    
    let matches = [];
    for (let i = 0; i < seededPlayers.length; i += 2) {
        const p1 = seededPlayers[i];
        const p2 = seededPlayers[i + 1] || null; // If odd number, p2 gets a BYE

        matches.push({
            id: crypto.randomUUID(),
            round: 1,
            player1: p1,
            player2: p2,
            score1: 0, score2: 0,
            winner: p2 === null ? p1 : null,
            isBye: p2 === null
        });
    }

    return {
        type: "swiss",
        totalRounds: maxRounds,
        rounds: [matches],
        pastMatchups: [], // We need to track who played who!
        isComplete: false
    };
}

export function advanceStage(stageData, config, allPlayers) {
    const currentRoundNum = stageData.rounds.length;
    const lastRound = stageData.rounds[currentRoundNum - 1];

    // 1. Log past matchups AND track who has had a BYE
    if (!stageData.playersWithByes) stageData.playersWithByes = [];
    
    lastRound.forEach(m => {
        if (m.isBye && m.player1) {
            stageData.playersWithByes.push(m.player1.id);
        } else if (m.player1 && m.player2) {
            stageData.pastMatchups.push(`${m.player1.id}-${m.player2.id}`);
            stageData.pastMatchups.push(`${m.player2.id}-${m.player1.id}`);
        }
    });

    if (currentRoundNum >= stageData.totalRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    // 2. Get active players and sort by Points (Highest to Lowest)
    const activePlayerIds = lastRound.flatMap(m => [m.player1?.id, m.player2?.id]).filter(id => id);
    let playersToPair = allPlayers.filter(p => activePlayerIds.includes(p.id));
    playersToPair.sort((a, b) => b.stats.points - a.stats.points);

    let nextRoundMatches = [];
    let pairedIds = new Set();

    // 3. Handle Odd Players (The BYE)
    if (playersToPair.length % 2 !== 0) {
        // Find the LOWEST ranked player who hasn't had a BYE yet
        let byePlayer = null;
        for (let i = playersToPair.length - 1; i >= 0; i--) {
            const p = playersToPair[i];
            if (!stageData.playersWithByes.includes(p.id)) {
                byePlayer = p;
                break;
            }
        }
        
        // Failsafe: if everyone somehow had a bye (impossible in standard length), just pick the lowest
        if (!byePlayer) byePlayer = playersToPair[playersToPair.length - 1];

        pairedIds.add(byePlayer.id);
        nextRoundMatches.push({
            id: crypto.randomUUID(),
            round: currentRoundNum + 1,
            player1: byePlayer,
            player2: null,
            score1: 0, score2: 0,
            winner: byePlayer,
            isBye: true
        });
    }

    // 4. Matchmaking logic for the remaining even number of players
    for (let i = 0; i < playersToPair.length; i++) {
        const p1 = playersToPair[i];
        if (pairedIds.has(p1.id)) continue;

        let opponent = null;

        // Look for the next highest player they HAVEN'T played yet
        for (let j = i + 1; j < playersToPair.length; j++) {
            const potentialOpponent = playersToPair[j];
            if (pairedIds.has(potentialOpponent.id)) continue;

            const matchupKey = `${p1.id}-${potentialOpponent.id}`;
            if (!stageData.pastMatchups.includes(matchupKey)) {
                opponent = potentialOpponent;
                break;
            }
        }

        // Failsafe: if no unique opponent is found, play the next available person
        // (This happens in very small tournaments with many rounds)
        if (!opponent) {
            opponent = playersToPair.find(p => p.id !== p1.id && !pairedIds.has(p.id));
        }

        if (opponent) {
            pairedIds.add(p1.id);
            pairedIds.add(opponent.id);

            nextRoundMatches.push({
                id: crypto.randomUUID(),
                round: currentRoundNum + 1,
                player1: p1,
                player2: opponent,
                score1: 0, score2: 0,
                winner: null,
                isBye: false
            });
        }
    }

    stageData.rounds.push(nextRoundMatches);
    return stageData;
}

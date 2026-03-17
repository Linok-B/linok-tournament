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

    // 1. Log all matchups from the round that just finished so we avoid rematches
    const lastRound = stageData.rounds[currentRoundNum - 1];
    lastRound.forEach(m => {
        if (m.player1 && m.player2) {
            stageData.pastMatchups.push(`${m.player1.id}-${m.player2.id}`);
            stageData.pastMatchups.push(`${m.player2.id}-${m.player1.id}`);
        }
    });

    // 2. Are we done?
    if (currentRoundNum >= stageData.totalRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    // 3. Get active players and sort them by current Points!
    // (We filter by players who were actually in this stage)
    const activePlayerIds = lastRound.flatMap(m => [m.player1?.id, m.player2?.id]).filter(id => id);
    let playersToPair = allPlayers.filter(p => activePlayerIds.includes(p.id));
    
    playersToPair.sort((a, b) => b.stats.points - a.stats.points);

    // 4. Matchmaking logic (Naive Dutch System)
    let nextRoundMatches = [];
    let pairedIds = new Set();

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

        // If no unique opponent found (rare in early rounds), just force play the next available person
        if (!opponent) {
            opponent = playersToPair.find(p => p.id !== p1.id && !pairedIds.has(p.id)) || null;
        }

        pairedIds.add(p1.id);
        if (opponent) pairedIds.add(opponent.id);

        nextRoundMatches.push({
            id: crypto.randomUUID(),
            round: currentRoundNum + 1,
            player1: p1,
            player2: opponent,
            score1: 0, score2: 0,
            winner: opponent === null ? p1 : null,
            isBye: opponent === null
        });
    }

    stageData.rounds.push(nextRoundMatches);
    return stageData;
}

export function initStage(players, config) {
    const seededPlayers = [...players].sort((a, b) => b.elo - a.elo);
    const numPlayers = seededPlayers.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const seedOrder = getStandardSeeding(bracketSize);

    let matches = [];
    for (let i = 0; i < bracketSize; i += 2) {
        const seed1 = seedOrder[i] - 1;
        const seed2 = seedOrder[i + 1] - 1;
        const p1 = seededPlayers[seed1] || null;
        const p2 = seededPlayers[seed2] || null;

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
        type: "single_elimination",
        bracketSize: bracketSize,
        rounds: [matches],
        isComplete: false
    };
}


export function advanceStage(stageData, config, allPlayers) {
    const currentRound = stageData.rounds[stageData.rounds.length - 1];
    const isRoundComplete = currentRound.every(m => m.winner !== null);

    if (!isRoundComplete) return stageData;

    // A stage is finished if:
    // 1. It was a 1-match round (Grand Finals done)
    // 2. It was a 2-match round and one was a 3rd place match (Bronze done)
    if (currentRound.length === 1 || (currentRound.length === 2 && currentRound.some(m => m.isThirdPlaceMatch))) {
        stageData.isComplete = true;
        return stageData;
    }

    if (config.maxRounds && stageData.rounds.length >= config.maxRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    let nextRoundMatches = [];
    const nextRoundNum = stageData.rounds.length + 1;

    // Check if the round that just ended was the Semi-Finals (2 matches)
    if (currentRound.length === 2) {
        // 1. Grand Finals
        nextRoundMatches.push({
            id: crypto.randomUUID(), round: nextRoundNum,
            player1: currentRound[0].winner, player2: currentRound[1].winner,
            score1: 0, score2: 0, winner: null, isBye: false
        });

        // 2. 3rd Place Match (If enabled in global settings)
        if (config.playThirdPlaceMatch) {
            const loser1 = currentRound[0].winner.id === currentRound[0].player1?.id ? currentRound[0].player2 : currentRound[0].player1;
            const loser2 = currentRound[1].winner.id === currentRound[1].player1?.id ? currentRound[1].player2 : currentRound[1].player1;
            
            nextRoundMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, isThirdPlaceMatch: true,
                player1: loser1, player2: loser2,
                score1: 0, score2: 0, winner: null, isBye: false
            });
        }
    } else {
        // Standard progression for Round of 16, 8, etc.
        for (let i = 0; i < currentRound.length; i += 2) {
            const m1 = currentRound[i];
            const m2 = currentRound[i + 1];
            const p1 = m1.winner;
            const p2 = m2 ? m2.winner : null;

            nextRoundMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum,
                player1: p1, player2: p2,
                score1: 0, score2: 0, winner: p2 === null ? p1 : null, isBye: p2 === null
            });
        }
    }
    
    stageData.rounds.push(nextRoundMatches);
    return stageData;
}

function getStandardSeeding(size) {
    let matches = [1, 2];
    for (let r = 1; r < Math.log2(size); r++) {
        let nextMatches = [];
        let sum = Math.pow(2, r + 1) + 1;
        for (let i = 0; i < matches.length; i++) {
            nextMatches.push(matches[i], sum - matches[i]);
        }
        matches = nextMatches;
    }
    return matches;
}

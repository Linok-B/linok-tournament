// js/engine/formats/elimination.js

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

// In js/engine/formats/elimination.js - Replace advanceStage

export function advanceStage(stageData, config) {
    const currentRound = stageData.rounds[stageData.rounds.length - 1];
    
    // Check if the bracket is finished (Finals completed)
    if (currentRound.length === 1) {
        stageData.isComplete = true;
        return stageData;
    }

    // NEW: Check if the host set a custom round limit!
    // E.g., Stop Single Elim after exactly 2 rounds.
    if (config.maxRounds && stageData.rounds.length >= config.maxRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    // Generate next round
    let nextRoundMatches = [];
    const nextRoundNum = stageData.rounds.length + 1;

    for (let i = 0; i < currentRound.length; i += 2) {
        const matchA = currentRound[i];
        const matchB = currentRound[i + 1];
        const p1 = matchA.winner;
        const p2 = matchB ? matchB.winner : null;

        nextRoundMatches.push({
            id: crypto.randomUUID(),
            round: nextRoundNum,
            player1: p1,
            player2: p2,
            score1: 0, score2: 0,
            winner: p2 === null ? p1 : null,
            isBye: p2 === null
        });
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

export function initStage(players, config) {
    const seededPlayers = [...players].sort((a, b) => a.seed - b.seed);
    const numPlayers = seededPlayers.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const seedOrder = getStandardSeeding(bracketSize);

    let winnersRound1 = [];

    // Generate Winner's Round 1
    for (let i = 0; i < bracketSize; i += 2) {
        const seed1 = seedOrder[i] - 1;
        const seed2 = seedOrder[i + 1] - 1;
        const p1 = seededPlayers[seed1] || null;
        const p2 = seededPlayers[seed2] || null;

        winnersRound1.push({
            id: crypto.randomUUID(),
            round: 1,
            bracket: "winners", // CRUCIAL: We must label which bracket this match belongs to :v
            player1: p1,
            player2: p2,
            score1: 0, score2: 0, draws: 0,
            winner: p2 === null ? p1 : null,
            isBye: p2 === null,
            isGrandFinals: false
        });
    }

    return {
        type: "double_elimination",
        bracketSize: bracketSize,
        // In Double Elim, "rounds" will contain a mix of Winner and Loser matches
        rounds: [winnersRound1], 
        isComplete: false
    };
}

// Standard Seeding Math
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

export function advanceStage(stageData, config, allPlayers) {
    console.log("Double Elimination Advance Triggered!");
    // (Advance Logic goes here :p)
    return stageData;
}

export function generateSingleElimination(players) {
    // 1. Sort players by ELO/Seed (Highest ELO is Seed 1)
    const seededPlayers = [...players].sort((a, b) => b.elo - a.elo);
    const numPlayers = seededPlayers.length;

    // 2. Calculate bracket size (next power of 2: 2, 4, 8, 16, 32...)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const numByes = bracketSize - numPlayers;

    // 3. Generate standard seeding pattern (e.g., 1v8, 4v5, 2v7, 3v6)
    const seedOrder = getStandardSeeding(bracketSize);

    let matches = [];
    let matchIdCounter = 1;

    // 4. Create Round 1 Matches
    for (let i = 0; i < bracketSize; i += 2) {
        // Seed order is 1-indexed, array is 0-indexed
        const seed1 = seedOrder[i] - 1;
        const seed2 = seedOrder[i + 1] - 1;

        const player1 = seededPlayers[seed1] || null; // Null means it's a BYE
        const player2 = seededPlayers[seed2] || null;

        matches.push({
            id: `R1-M${matchIdCounter}`,
            round: 1,
            player1: player1,
            player2: player2,
            score1: 0,
            score2: 0,
            winner: null,
            // If player 2 is null, player 1 automatically wins (Bye)
            isBye: player2 === null
        });
        matchIdCounter++;
    }

    return {
        type: "single_elimination",
        bracketSize: bracketSize,
        rounds: [matches] // We will calculate future rounds dynamically later
    };
}

// Helper: Standard Bracket Folding Algorithm
function getStandardSeeding(size) {
    let matches = [1, 2];
    let rounds = Math.log2(size);
    for (let r = 1; r < rounds; r++) {
        let nextMatches = [];
        let sum = Math.pow(2, r + 1) + 1;
        for (let i = 0; i < matches.length; i++) {
            nextMatches.push(matches[i]);
            nextMatches.push(sum - matches[i]);
        }
        matches = nextMatches;
    }
    return matches;
}


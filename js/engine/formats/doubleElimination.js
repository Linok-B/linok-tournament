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

// In js/engine/formats/doubleElimination.js - Replace advanceStage

export function advanceStage(stageData, config, allPlayers) {
    const currentRound = stageData.rounds[stageData.rounds.length - 1];
    const isRoundComplete = currentRound.every(m => m.winner !== null);

    if (!isRoundComplete) return stageData;

    // --- 1. GRAND FINALS LOGIC ---
    const isGrandFinals = currentRound[0] && currentRound[0].bracket === "grand_finals";
    if (isGrandFinals) {
        const gfMatch = currentRound[0];
        // Did the Loser's Bracket winner (player2) beat the Undefeated winner (player1)?
        if (!gfMatch.bracketReset && gfMatch.winner.id === gfMatch.player2.id) {
            stageData.rounds.push([{
                id: crypto.randomUUID(), round: stageData.rounds.length + 1, bracket: "grand_finals",
                player1: gfMatch.player1, player2: gfMatch.player2,
                score1: 0, score2: 0, draws: 0, winner: null, isBye: false,
                bracketReset: true
            }]);
            return stageData;
        }
        stageData.isComplete = true;
        return stageData;
    }

    if (config.maxRounds && stageData.rounds.length >= config.maxRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    // --- 2. SEPARATE COMPLETED MATCHES ---
    const wMatches = currentRound.filter(m => m.bracket === "winners");
    const lMatches = currentRound.filter(m => m.bracket === "losers");

    const nextRoundNum = stageData.rounds.length + 1;
    let newWMatches = [];
    let newLMatches = [];

    // --- 3. ADVANCE WINNERS BRACKET ---
    // If there is only 1 Winner match left, they are the Undefeated Champ. They wait!
    if (wMatches.length > 1) {
        for (let i = 0; i < wMatches.length; i += 2) {
            const p1 = wMatches[i].winner;
            const p2 = wMatches[i + 1] ? wMatches[i + 1].winner : null;
            newWMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "winners",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null
            });
        }
    }

    // --- 4. ADVANCE LOSERS BRACKET ---
    // Who just lost in the Winner's Bracket?
    const newDrops = wMatches.map(m => m.winner.id === m.player1?.id ? m.player2 : m.player1).filter(p => p !== null);
    // Who survived the previous Loser's Bracket round?
    const survivingLosers = lMatches.map(m => m.winner).filter(p => p !== null);

    if (wMatches.length > 0 && lMatches.length === 0) {
        // Phase 1: The very first drop (Losers Round 1)
        for (let i = 0; i < newDrops.length; i += 2) {
            const p1 = newDrops[i];
            const p2 = newDrops[i + 1] || null;
            newLMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null
            });
        }
    } else if (newDrops.length > 0) {
        // Phase 2: Minor Round (New drops fight the surviving losers)
        // Standard Crossover: We reverse the drops so you don't instantly rematch the person who beat you!
        newDrops.reverse();
        for (let i = 0; i < survivingLosers.length; i++) {
            const p1 = survivingLosers[i];
            const p2 = newDrops[i] || null;
            newLMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null
            });
        }
    } else if (survivingLosers.length > 1) {
        // Phase 3: Major Round (Surviving losers fight each other)
        for (let i = 0; i < survivingLosers.length; i += 2) {
            const p1 = survivingLosers[i];
            const p2 = survivingLosers[i + 1] || null;
            newLMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null
            });
        }
    }

    // --- 5. GENERATE GRAND FINALS ---
    // If Winners has finished (0 new matches) AND Losers is down to 1 survivor!
    if (newWMatches.length === 0 && newLMatches.length === 0 && survivingLosers.length === 1) {
        // Find the Undefeated Champion from the last Winner's match!
        let champMatch = stageData.rounds.flat().reverse().find(m => m.bracket === "winners");
        
        stageData.rounds.push([{
            id: crypto.randomUUID(), round: nextRoundNum, bracket: "grand_finals",
            player1: champMatch.winner, player2: survivingLosers[0],
            score1: 0, score2: 0, draws: 0, winner: null, isBye: false,
            bracketReset: false
        }]);
        return stageData;
    }

    stageData.rounds.push([...newWMatches, ...newLMatches]);
    return stageData;
}

export function generateSkeleton(playerCount) {
    // 1. Calculate bracket size (Next power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const winnerRoundsCount = Math.log2(bracketSize);
    
    // Loser bracket has 2 rounds for every Winner round (except the first drop)
    const loserRoundsCount = (winnerRoundsCount * 2) - 1; 

    let skeletonRounds = [];
    
    // --- WINNERS BRACKET SKELETON ---
    // Round 1 has (bracketSize / 2) matches. Each round halves.
    let currentWinnersMatches = bracketSize / 2;
    for (let r = 0; r < winnerRoundsCount; r++) {
        let roundArray = [];
        for (let m = 0; m < currentWinnersMatches; m++) {
            roundArray.push({ id: `ghost-w-${r}-${m}`, bracket: "winners", isGhost: true });
        }
        skeletonRounds.push(roundArray);
        currentWinnersMatches /= 2;
    }

    // --- LOSERS BRACKET SKELETON ---
    // Losers bracket logic: Minor Round (Drops), Major Round (Halves).
    let currentLosersMatches = bracketSize / 4; 
    let isMinorRound = true;

    for (let r = 0; r < loserRoundsCount; r++) {
        // Losers start in Column 2 (Round Index 1) because W-R1 happens first
        const targetColumn = r + 1; 
        
        // Ensure the skeleton array is long enough
        if (!skeletonRounds[targetColumn]) skeletonRounds[targetColumn] = [];

        for (let m = 0; m < currentLosersMatches; m++) {
            skeletonRounds[targetColumn].push({ id: `ghost-l-${r}-${m}`, bracket: "losers", isGhost: true });
        }

        // Alternate logic: After a Minor Round, the match count stays the same.
        // After a Major Round, the match count halves.
        if (!isMinorRound) {
            currentLosersMatches /= 2;
        }
        isMinorRound = !isMinorRound;
    }

    // --- GRAND FINALS SKELETON ---
    // GF 1 happens in the column after the Loser's Finals
    const gf1Column = loserRoundsCount + 1;
    if (!skeletonRounds[gf1Column]) skeletonRounds[gf1Column] = [];
    skeletonRounds[gf1Column].push({ id: `ghost-gf1`, bracket: "grand_finals", isGhost: true, bracketReset: false });

    // GF 2 (The Pessimistic Reset Match)
    const gf2Column = gf1Column + 1;
    if (!skeletonRounds[gf2Column]) skeletonRounds[gf2Column] = [];
    skeletonRounds[gf2Column].push({ id: `ghost-gf2`, bracket: "grand_finals", isGhost: true, bracketReset: true });

    return skeletonRounds;
}

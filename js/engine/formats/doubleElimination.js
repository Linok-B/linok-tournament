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
    const currentRound = stageData.rounds[stageData.rounds.length - 1];
    const isRoundComplete = currentRound.every(m => m.winner !== null);

    if (!isRoundComplete) return stageData;

    const isGrandFinals = currentRound[0] && currentRound[0].bracket === "grand_finals";
    if (isGrandFinals) {
        const gfMatch = currentRound[0];
        if (!gfMatch.bracketReset && gfMatch.winner.id === gfMatch.player2?.id) {
            stageData.rounds.push([createMatch(gfMatch.player1, gfMatch.player2, stageData.rounds.length + 1, "grand_finals", true)]);
            return stageData;
        }
        stageData.isComplete = true;
        return stageData;
    }

    if (config.maxRounds && stageData.rounds.length >= config.maxRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    const nextRoundNum = stageData.rounds.length + 1;
    const wMatches = currentRound.filter(m => m.bracket === "winners");
    const lMatches = currentRound.filter(m => m.bracket === "losers");

    let newWMatches = [];
    let newLMatches = [];

    // --- 1. ADVANCE WINNERS ---
    if (wMatches.length > 1) {
        for (let i = 0; i < wMatches.length; i += 2) {
            newWMatches.push(createMatch(wMatches[i].winner, wMatches[i + 1]?.winner, nextRoundNum, "winners"));
        }
    }

    // --- 2. ADVANCE LOSERS ---
    // CRITICAL FIX: Do NOT filter out nulls! We must keep the exact array length to preserve the bracket shape!
    const newDrops = wMatches.map(m => {
        if (m.winner?.isPhantom) return null;
        if (m.winner?.id === m.player1?.id) return m.player2 || null;
        return m.player1 || null;
    });
    newDrops.reverse(); // Standard crossover rule

    const survivingLosers = lMatches.map(m => m.winner?.isPhantom ? null : (m.winner || null));

    if (wMatches.length > 0 && lMatches.length === 0) {
        // Phase 1: First drops
        for (let i = 0; i < newDrops.length; i += 2) {
            newLMatches.push(createMatch(newDrops[i], newDrops[i + 1], nextRoundNum, "losers"));
        }
    } else if (newDrops.length > 0) {
        // Phase 2: Minor Round (Drops vs Survivors) - PERFECT 1:1 MATCH NOW!
        for (let i = 0; i < survivingLosers.length; i++) {
            newLMatches.push(createMatch(survivingLosers[i], newDrops[i], nextRoundNum, "losers"));
        }
    } else if (survivingLosers.length > 1) {
        // Phase 3: Major Round (Survivors vs Survivors)
        for (let i = 0; i < survivingLosers.length; i += 2) {
            newLMatches.push(createMatch(survivingLosers[i], survivingLosers[i + 1], nextRoundNum, "losers"));
        }
    }

    // --- 3. GENERATE GRAND FINALS ---
    if (newWMatches.length === 0 && newLMatches.length === 0 && survivingLosers.length === 1) {
        const champMatch = stageData.rounds.flat().reverse().find(m => m.bracket === "winners");
        const wChamp = champMatch.winner?.isPhantom ? null : champMatch.winner;
        stageData.rounds.push([createMatch(wChamp, survivingLosers[0], nextRoundNum, "grand_finals", false, true)]);
        return stageData;
    }

    stageData.rounds.push([...newWMatches, ...newLMatches]);
    return stageData;
}

// HELPER: Generates matches and safely handles "null vs null" Phantom Byes!
function createMatch(p1, p2, roundNum, bracket, isBracketReset = false, isGF = false) {
    p1 = p1 || null; 
    p2 = p2 || null;
    const isPhantom = p1 === null && p2 === null;
    
    let winner = null;
    let isBye = false;
    
    if (isPhantom) {
        winner = { id: "phantom", isPhantom: true }; // Auto-completes the match to prevent softlocks!
        isBye = true;
    } else if (p2 === null) {
        winner = p1;
        isBye = true;
    } else if (p1 === null) {
        winner = p2;
        isBye = true;
    }
    
    return {
        id: crypto.randomUUID(), round: roundNum, bracket: bracket,
        player1: p1, player2: p2,
        score1: 0, score2: 0, draws: 0, winner: winner, isBye: isBye,
        isGrandFinals: isGF, bracketReset: isBracketReset
    };
}

export function generateSkeleton(playerCount) {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
    const winnerRoundsCount = Math.log2(bracketSize);
    
    const loserRoundsCount = (winnerRoundsCount * 2) - 2; 

    let skeletonRounds = [];
    
    // Winners Skeleton
    let currentWinnersMatches = bracketSize / 2;
    for (let r = 0; r < winnerRoundsCount; r++) {
        if (!skeletonRounds[r]) skeletonRounds[r] = [];
        for (let m = 0; m < currentWinnersMatches; m++) {
            skeletonRounds[r].push({ id: `ghost-w-${r}-${m}`, bracket: "winners", isGhost: true });
        }
        currentWinnersMatches /= 2;
    }

    // Losers Skeleton
    let currentLosersMatches = bracketSize / 4; 
    let isMinorRound = true;
    for (let r = 0; r < loserRoundsCount; r++) {
        const targetColumn = r + 1; // Losers start in column 2
        if (!skeletonRounds[targetColumn]) skeletonRounds[targetColumn] = [];

        for (let m = 0; m < currentLosersMatches; m++) {
            skeletonRounds[targetColumn].push({ id: `ghost-l-${r}-${m}`, bracket: "losers", isGhost: true });
        }
        if (!isMinorRound) currentLosersMatches /= 2;
        isMinorRound = !isMinorRound;
    }

    // Grand Finals Skeleton
    const gf1Column = loserRoundsCount + 1;
    if (!skeletonRounds[gf1Column]) skeletonRounds[gf1Column] = [];
    skeletonRounds[gf1Column].push({ id: `ghost-gf1`, bracket: "grand_finals", isGhost: true, bracketReset: false });

    const gf2Column = gf1Column + 1;
    if (!skeletonRounds[gf2Column]) skeletonRounds[gf2Column] = [];
    skeletonRounds[gf2Column].push({ id: `ghost-gf2`, bracket: "grand_finals", isGhost: true, bracketReset: true });

    return skeletonRounds;
}


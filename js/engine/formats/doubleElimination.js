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

    // Check if we just finished the Grand Finals
    const isGrandFinals = currentRound.length === 1 && currentRound[0].isGrandFinals;
    if (isGrandFinals) {
        
        // Did the Loser's Bracket Champion just beat the Winner's Bracket Champion?
        // If so, we must generate the "Bracket Reset" match!
        const grandFinalMatch = currentRound[0];
        
        if (!grandFinalMatch.bracketReset && grandFinalMatch.winner.id === grandFinalMatch.player2.id) {
            console.log("Bracket Reset Triggered!");
            const bracketResetMatches = [{
                id: crypto.randomUUID(), round: stageData.rounds.length + 1, bracket: "grand_finals",
                player1: grandFinalMatch.player1, player2: grandFinalMatch.player2,
                score1: 0, score2: 0, draws: 0, winner: null, isBye: false,
                isGrandFinals: true, bracketReset: true // Mark that this is the final reset!
            }];
            stageData.rounds.push(bracketResetMatches);
            return stageData;
        }
        
        // Otherwise, the Winner's Champion won (or the Reset match finished). Tournament Over!
        stageData.isComplete = true;
        return stageData;
    }

    // --- DOUBLE ELIMINATION ROUTING MATH ---
    const nextRoundNum = stageData.rounds.length + 1;
    let nextRoundMatches = [];
    
    // Separate current matches into Winners and Losers brackets
    const winnersMatches = currentRound.filter(m => m.bracket === "winners");
    const losersMatches = currentRound.filter(m => m.bracket === "losers");

    // 1. ADVANCE WINNER'S BRACKET
    let newWinnersMatches = [];
    if (winnersMatches.length >= 2) {
        for (let i = 0; i < winnersMatches.length; i += 2) {
            const m1 = winnersMatches[i];
            const m2 = winnersMatches[i + 1];
            const p1 = m1.winner;
            const p2 = m2 ? m2.winner : null;

            newWinnersMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "winners",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null,
                isGrandFinals: false
            });
        }
    }

    // 2. ADVANCE LOSER'S BRACKET
    let newLosersMatches = [];
    
    // Identify who just lost in the Winner's Bracket
    const droppedLosers = winnersMatches.map(m => {
        return m.winner.id === m.player1?.id ? m.player2 : m.player1;
    }).filter(p => p !== null); // Ignore Byes
    
    // Reverse the dropped losers array to prevent immediate rematches! (Standard Crossover Rule)
    droppedLosers.reverse();

    // Are there people already waiting in the Loser's Bracket who survived the previous round?
    const survivingLosers = losersMatches.map(m => m.winner).filter(p => p !== null);

    if (survivingLosers.length === 0 && droppedLosers.length > 0) {
        // This is Losers Round 1 (The first drop from Winners R1)
        for (let i = 0; i < droppedLosers.length; i += 2) {
            const p1 = droppedLosers[i];
            const p2 = droppedLosers[i + 1] || null;
            newLosersMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null,
                isGrandFinals: false
            });
        }
    } else if (survivingLosers.length > 0 && droppedLosers.length > 0) {
        // This is an Even-Numbered Losers Round (Winners dropping down to face surviving Losers)
        for (let i = 0; i < survivingLosers.length; i++) {
            const p1 = survivingLosers[i];
            const p2 = droppedLosers[i] || null; // Match survivors against fresh drops
            newLosersMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null,
                isGrandFinals: false
            });
        }
    } else if (survivingLosers.length >= 2 && droppedLosers.length === 0) {
        // This is an Odd-Numbered Losers Round (Surviving Losers playing each other)
        for (let i = 0; i < survivingLosers.length; i += 2) {
            const p1 = survivingLosers[i];
            const p2 = survivingLosers[i + 1] || null;
            newLosersMatches.push({
                id: crypto.randomUUID(), round: nextRoundNum, bracket: "losers",
                player1: p1, player2: p2,
                score1: 0, score2: 0, draws: 0, winner: p2 === null ? p1 : null, isBye: p2 === null,
                isGrandFinals: false
            });
        }
    }

    // 3. GENERATE GRAND FINALS (If Winners Bracket is down to 1 person, and Losers Bracket is down to 1 person)
    if (winnersMatches.length === 1 && losersMatches.length === 1) {
        console.log("Generating Grand Finals!");
        nextRoundMatches.push({
            id: crypto.randomUUID(), round: nextRoundNum, bracket: "grand_finals",
            player1: winnersMatches[0].winner, // Winner's Bracket Champion
            player2: losersMatches[0].winner,  // Loser's Bracket Champion
            score1: 0, score2: 0, draws: 0, winner: null, isBye: false,
            isGrandFinals: true, bracketReset: false // First match of Grand Finals
        });
    } else {
        // Combine both brackets for the next standard round
        nextRoundMatches = [...newWinnersMatches, ...newLosersMatches];
    }

    stageData.rounds.push(nextRoundMatches);
    return stageData;
}

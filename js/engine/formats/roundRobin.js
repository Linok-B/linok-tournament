export function initStage(players, config) {
    // Round Robin requires an even number of players for the math to work. Add a dummy "BYE" player if odd.
    let rrPlayers = [...players];
    if (rrPlayers.length % 2 !== 0) rrPlayers.push(null); 

    const totalPossibleRounds = rrPlayers.length - 1;
    // Allow the host to set custom round limits (e.g. only play 3 rounds of RR instead of everyone)
    const roundsToPlay = config.maxRounds ? Math.min(config.maxRounds, totalPossibleRounds) : totalPossibleRounds;

    const matches = [];
    
    // The Circle Method Algorithm
    for (let round = 0; round < roundsToPlay; round++) {
        let roundMatches = [];
        for (let i = 0; i < rrPlayers.length / 2; i++) {
            const p1 = rrPlayers[i];
            const p2 = rrPlayers[rrPlayers.length - 1 - i];
            
            // If neither is null (BYE), create a match
            if (p1 !== null && p2 !== null) {
                roundMatches.push({
                    id: crypto.randomUUID(),
                    round: round + 1,
                    player1: p1,
                    player2: p2,
                    score1: 0, score2: 0,
                    winner: null,
                    isBye: false
                });
            }
        }
        matches.push(roundMatches);
        
        // Rotate players (keep index 0 fixed, rotate the rest)
        rrPlayers.splice(1, 0, rrPlayers.pop());
    }

    // Because RR determines all matchups instantly, we store them all, 
    // but we will only "activate" Round 1 for the UI.
    return {
        type: "round_robin",
        totalRounds: roundsToPlay,
        currentRoundIndex: 0,
        allRounds: matches, // Stores the pre-calculated blueprint
        rounds: [matches[0]], // What the UI actually sees and plays
        isComplete: false
    };
}

export function advanceStage(stageData, config) {
    stageData.currentRoundIndex++;
    
    if (stageData.currentRoundIndex >= stageData.totalRounds) {
        stageData.isComplete = true;
    } else {
        // Push the next pre-calculated round into the active rounds array
        stageData.rounds.push(stageData.allRounds[stageData.currentRoundIndex]);
    }
    
    return stageData;
}

const WHITE = 'W';
const BLACK = 'B';

function computeColorState(colorHistory) {
    let gamesWhite = 0;
    let gamesBlack = 0;
    for (let c of colorHistory) {
        if (c === WHITE) gamesWhite++;
        else if (c === BLACK) gamesBlack++;
    }

    const imbalance = gamesWhite - gamesBlack; // Positive = more White
    let streak = 0;
    let lastColor = null;

    if (colorHistory.length > 0) {
        lastColor = colorHistory[colorHistory.length - 1];
        for (let i = colorHistory.length - 1; i >= 0; i--) {
            if (colorHistory[i] === lastColor) streak++;
            else break;
        }
    }

    const absImbalance = Math.abs(imbalance);
    const repeatedColor = streak >= 2 ? lastColor : null;

    let preference = null;
    if (absImbalance > 1) {
        preference = imbalance > 0 ? BLACK : WHITE;
    } else if (repeatedColor !== null) {
        preference = repeatedColor === WHITE ? BLACK : WHITE;
    } else if (absImbalance > 0) {
        preference = imbalance > 0 ? BLACK : WHITE;
    } else if (streak === 1) {
        preference = lastColor === WHITE ? BLACK : WHITE;
    }

    return { preference, imbalance, absImbalance };
}

export function optimizeMatchColors(rawPairs, stageData) {
    // 1. Build historical color history per player from past non-bye rounds
    const historyMap = new Map();

    if (stageData && stageData.rounds) {
        stageData.rounds.forEach(round => {
            round.forEach(match => {
                if (match.isBye || !match.player1 || !match.player2) return;

                const p1Id = match.player1.id;
                const p2Id = match.player2.id;

                if (!historyMap.has(p1Id)) historyMap.set(p1Id, []);
                if (!historyMap.has(p2Id)) historyMap.set(p2Id, []);

                historyMap.get(p1Id).push(WHITE); // player1 was White
                historyMap.get(p2Id).push(BLACK); // player2 was Black
            });
        });
    }

    // 2. Determine (player1 = White, player2 = Black) for each confirmed pair
    return rawPairs.map(({ p1, p2, isBye }) => {
        if (isBye || !p2) {
            return { player1: p1, player2: null, isBye: true };
        }

        const hist1 = historyMap.get(p1.id) || [];
        const hist2 = historyMap.get(p2.id) || [];

        const cs1 = computeColorState(hist1);
        const cs2 = computeColorState(hist2);

        let finalP1 = p1; // Default to existing matcher order
        let finalP2 = p2;

        // Rule A: Opposite preferences (both get what they prefer)
        if (cs1.preference && cs2.preference && cs1.preference !== cs2.preference) {
            if (cs1.preference === WHITE) { finalP1 = p1; finalP2 = p2; }
            else { finalP1 = p2; finalP2 = p1; }
        }
        // Rule B: Only one player has a preference
        else if (cs1.preference && !cs2.preference) {
            if (cs1.preference === WHITE) { finalP1 = p1; finalP2 = p2; }
            else { finalP1 = p2; finalP2 = p1; }
        }
        else if (!cs1.preference && cs2.preference) {
            if (cs2.preference === WHITE) { finalP1 = p2; finalP2 = p1; }
            else { finalP1 = p1; finalP2 = p2; }
        }
        // Rule C: Same preference collision -> player with larger absolute imbalance gets preference
        else if (cs1.preference && cs2.preference && cs1.preference === cs2.preference) {
            if (cs1.absImbalance !== cs2.absImbalance) {
                const p1Wins = cs1.absImbalance > cs2.absImbalance;
                const winner = p1Wins ? p1 : p2;
                const loser = p1Wins ? p2 : p1;
                const winPref = p1Wins ? cs1.preference : cs2.preference;

                if (winPref === WHITE) { finalP1 = winner; finalP2 = loser; }
                else { finalP1 = loser; finalP2 = winner; }
            }
            // If imbalances are equal: tiebreak is None -> keep matcher order [p1, p2]
        }
        // Rule D: Neither has preference -> keep matcher order [p1, p2]

        return { player1: finalP1, player2: finalP2, isBye: false };
    });
}

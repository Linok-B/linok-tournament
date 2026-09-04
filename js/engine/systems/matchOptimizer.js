export function optimizeMatchOrder(matches, rankedPlayers) {
    const playerRankMap = new Map();
    rankedPlayers.forEach((p, idx) => playerRankMap.set(p.id, idx));

    return [...matches].sort((mA, mB) => {
        // 1. Byes always go to the bottom board
        if (mA.isBye && !mB.isBye) return 1;
        if (!mA.isBye && mB.isBye) return -1;
        if (mA.isBye && mB.isBye) return 0;

        // 2. Best player rank on the board (lower index = higher standing)
        const rankA1 = playerRankMap.get(mA.player1?.id) ?? 999999;
        const rankA2 = playerRankMap.get(mA.player2?.id) ?? 999999;
        const bestA = Math.min(rankA1, rankA2);

        const rankB1 = playerRankMap.get(mB.player1?.id) ?? 999999;
        const rankB2 = playerRankMap.get(mB.player2?.id) ?? 999999;
        const bestB = Math.min(rankB1, rankB2);

        if (bestA !== bestB) return bestA - bestB;

        // 3. Opponent rank on the board
        const oppA = Math.max(rankA1, rankA2);
        const oppB = Math.max(rankB1, rankB2);
        return oppA - oppB;
    });
}

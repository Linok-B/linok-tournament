export function computeSigmoidPenaltyMatrix(players, roundsHistory, currentRound, nPlayers) {
    const N = players.length;
    const penaltyMatrix = new Float64Array(N * N).fill(0.0);

    const phaseLength = nPlayers - 1;
    if (phaseLength <= 0) return penaltyMatrix;

    const currentPhase = Math.floor((currentRound - 1) / phaseLength) + 1;
    if (currentPhase < 2) return penaltyMatrix; // Phase 1 has 0 inter-phase rematches

    // Head = Round that just ended; Tail = First round of immediately preceding phase
    const headRound = currentRound - 1;
    const tailRound = (currentPhase - 2) * phaseLength + 1;
    const span = Math.max(1, headRound - tailRound);

    // find the latest round each pair played in the previous phase
    const lastPlayedRound = new Map();
    roundsHistory.forEach((roundMatches, roundIdx) => {
        const rNum = roundIdx + 1;
        if (rNum >= tailRound && rNum <= headRound) {
            roundMatches.forEach(m => {
                if (m.player1 && m.player2 && !m.isBye) {
                    const key1 = `${m.player1.id}-${m.player2.id}`;
                    const key2 = `${m.player2.id}-${m.player1.id}`;
                    lastPlayedRound.set(key1, rNum);
                    lastPlayedRound.set(key2, rNum);
                }
            });
        }
    });

    const logistic = (t, k = 10, t0 = 0.5) => 1 / (1 + Math.exp(-k * (t - t0)));
    const f0 = logistic(0), f1 = logistic(1);

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            const p1 = players[i];
            const p2 = players[j];
            const rPlayed = lastPlayedRound.get(`${p1.id}-${p2.id}`);

            if (rPlayed !== undefined) {
                const t = (rPlayed - tailRound) / span; // 0.0 at tail, 1.0 at head
                const normalizedSigmoid = (logistic(t) - f0) / (f1 - f0);
                penaltyMatrix[i * N + j] = normalizedSigmoid;
                penaltyMatrix[j * N + i] = normalizedSigmoid;
            }
        }
    }

    return penaltyMatrix;
}

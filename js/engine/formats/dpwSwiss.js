import { requestMatchmaking } from '../matchmakers/matchmakerBridge.js';
import { calculateTiebreakers } from '../systems/tiebreakers.js';
import { openSearchFallbackModal } from '../../ui/searchFallbackModal.js';

function fisherYatesShuffle(arr) {
// smh I just noticed a problem
}

export function initStage(players, config) {
    const seededPlayers = [...players].sort((a, b) => a.seed - b.seed);
    const defaultRounds = Math.ceil(Math.log2(seededPlayers.length));
    const maxRounds = config.maxRounds || defaultRounds;
    const mode = config.round1Mode || "sequential";
    
    const n = seededPlayers.length;
    let pairs = [];

    if (mode === "folded") {
        // 1 vs N, 2 vs N-1, ...
        for (let i = 0; i < Math.floor(n / 2); i++) {
            pairs.push([seededPlayers[i], seededPlayers[n - 1 - i]]);
        }
        if (n % 2 !== 0) {
            pairs.push([seededPlayers[Math.floor(n / 2)], null]); // Middle gets Bye
        }
    } else if (mode === "halves") {
        // 1 vs N/2+1, 2 vs N/2+2, ...
        const half = Math.ceil(n / 2);
        for (let i = 0; i < Math.floor(n / 2); i++) {
            pairs.push([seededPlayers[i], seededPlayers[half + i]]);
        }
        if (n % 2 !== 0) {
            pairs.push([seededPlayers[half - 1], null]);
        }
    } else {
        // Sequential (Default): 1 vs 2, 3 vs 4, ...
        for (let i = 0; i < n; i += 2) {
            pairs.push([seededPlayers[i], seededPlayers[i + 1] || null]);
        }
    }

    let matches = [];
    pairs.forEach(([p1, p2]) => {
        matches.push({
            id: crypto.randomUUID(),
            round: 1,
            player1: p1,
            player2: p2,
            score1: 0, score2: 0,
            winner: p2 === null ? p1 : null,
            isBye: p2 === null
        });
    });

    return {
        type: config.type || "swiss",
        totalRounds: maxRounds,
        rounds: [matches],
        pastMatchups: [],
        isComplete: false
    };
}

export async function advanceStage(stageData, config, allPlayers) {
    const currentRoundNum = stageData.rounds.length;
    const lastRound = stageData.rounds[currentRoundNum - 1];

    if (!stageData.playersWithByes) stageData.playersWithByes = [];
    if (!stageData.pastMatchups) stageData.pastMatchups = [];

    lastRound.forEach(m => {
        if (m.isBye && m.player1) {
            stageData.playersWithByes.push(m.player1.id);
        } else if (m.player1 && m.player2) {
            stageData.pastMatchups.push(`${m.player1.id}-${m.player2.id}`);
            stageData.pastMatchups.push(`${m.player2.id}-${m.player1.id}`);
        }
    });

    if (currentRoundNum >= stageData.totalRounds) {
        stageData.isComplete = true;
        return stageData;
    }

    const activePlayerIds = lastRound.flatMap(m => [m.player1?.id, m.player2?.id]).filter(id => id);
    let playersToPair = allPlayers.filter(p => activePlayerIds.includes(p.id));

    // 1. PIPELINE: Fisher-Yates -> Sort strictly by DPW Rating & Team Score Tiebreakers
    const isFY = config.orderMode !== "og";
    if (isFY) fisherYatesShuffle(playersToPair);

    let pairingRules = config.pairingTiebreakers || config.tiebreakers || ["dpw_rating", "team_score", "head_to_head", "buchholz", "seed"];
    // Ensure dpw_rating is primary
    pairingRules = ["dpw_rating", ...pairingRules.filter(r => r !== "dpw_rating")];

    const sortFn = calculateTiebreakers(allPlayers, [ { data: stageData, config: config } ]);
    playersToPair.sort((a, b) => sortFn(a, b, pairingRules));

    // 2. Odd player count: append Dummy Bye Player
    const isOdd = (playersToPair.length % 2 !== 0);
    const hasDummy = isOdd && config.pairingAlgorithm !== "plain_greedy";
    
    let pairingPool = [...playersToPair];
    if (hasDummy) {
        pairingPool.push({ id: "__BYE_DUMMY__", name: "BYE", isDummy: true, stats: { dpwRating: -9999 } });
    }

    const N = pairingPool.length;
    const W = Math.ceil(N / 64);
    const ranks = Array.from({ length: N }, (_, i) => i);
    const playedMatrix = Array.from({ length: N }, () => new Array(W).fill(0n));

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            const p1 = pairingPool[i];
            const p2 = pairingPool[j];

            let alreadyPlayed = false;
            if (p1.isDummy) {
                alreadyPlayed = stageData.playersWithByes.includes(p2.id);
            } else if (p2.isDummy) {
                alreadyPlayed = stageData.playersWithByes.includes(p1.id);
            } else {
                alreadyPlayed = stageData.pastMatchups.includes(`${p1.id}-${p2.id}`);
            }

            if (alreadyPlayed) {
                const word_j = Math.floor(j / 64);
                const bit_j = BigInt(j % 64);
                playedMatrix[i][word_j] |= (1n << bit_j);

                const word_i = Math.floor(i / 64);
                const bit_i = BigInt(i % 64);
                playedMatrix[j][word_i] |= (1n << bit_i);
            }
        }
    }

    const algo = config.pairingAlgorithm || "mrv";
    const allowBacktrack = config.greedyMode !== "plain";
    const isTopK = config.blossomMode !== "standard";
    const cdclMode = config.cdclMode !== undefined ? config.cdclMode : 1;
    const maxCand = config.maxCandidates || (algo === "blossom" ? 100 : 1000);

    const matchmakerParams = {
        n: N,
        engineType: algo,
        isTopK: isTopK,
        allowBacktrack: allowBacktrack,
        checkUpToDegree: (stageData.passiveCDCL || cdclMode === 0) ? 0 : (cdclMode === 2 ? Math.floor(N / 2) : 6),
        maxCandidates: maxCand,
        currentRound: currentRoundNum + 1,
        ranks: ranks,
        playedMatrix: playedMatrix.map(row => row.map(w => w.toString()))
    };

    let result = await requestMatchmaking(matchmakerParams);

    if (result.status === 1 || result.status === 2) {
        result = await new Promise((resolve) => {
            openSearchFallbackModal({
                limitType: result.status === 2 ? "timeout" : "candidates",
                n: N,
                players: pairingPool,
                candidatePairs: result.pairs,
                playedMatrix: playedMatrix,
                currentRound: currentRoundNum + 1,
                onResume: async (extraBudget) => {
                    const resumeParams = {
                        ...matchmakerParams,
                        maxCandidates: maxCand + extraBudget.extraCandidates,
                    };
                    const res = await requestMatchmaking(resumeParams);
                    resolve(res);
                },
                onAcceptDoomed: (doomedPairs) => {
                    stageData.passiveCDCL = true;
                    resolve({ status: 0, pairCount: doomedPairs.length, pairs: doomedPairs });
                },
                onManualPair: (manualPairs) => {
                    stageData.passiveCDCL = true;
                    resolve({ status: 0, pairCount: manualPairs.length, pairs: manualPairs });
                }
            });
        });
    }

    const nextRoundMatches = [];
    result.pairs.forEach(([uIdx, vIdx]) => {
        const p1 = pairingPool[uIdx];
        const p2 = pairingPool[vIdx];

        if (p1.isDummy || p2.isDummy) {
            const realPlayer = p1.isDummy ? p2 : p1;
            nextRoundMatches.push({
                id: crypto.randomUUID(),
                round: currentRoundNum + 1,
                player1: realPlayer,
                player2: null,
                score1: 0, score2: 0,
                winner: realPlayer,
                isBye: true
            });
        } else {
            nextRoundMatches.push({
                id: crypto.randomUUID(),
                round: currentRoundNum + 1,
                player1: p1,
                player2: p2,
                score1: 0, score2: 0,
                winner: null,
                isBye: false
            });
        }
    });

    stageData.rounds.push(nextRoundMatches);
    return stageData;
}

import { requestMatchmaking } from '../matchmakers/matchmakerBridge.js';
import { computeSigmoidPenaltyMatrix } from '../matchmakers/sigmoidDecay.js';
import { calculateTiebreakers } from '../systems/tiebreakers.js';
import { openSearchFallbackModal } from '../../ui/searchFallbackModal.js';

function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export function initStage(players, config) {
    // Round 1 of Swiss: Just pair them by seed (1v2, 3v4)
    const seededPlayers = [...players].sort((a, b) => a.seed - b.seed);
    const defaultRounds = Math.ceil(Math.log2(seededPlayers.length));
    const maxRounds = config.maxRounds || defaultRounds;
    
    let matches = [];
    for (let i = 0; i < seededPlayers.length; i += 2) {
        const p1 = seededPlayers[i];
        const p2 = seededPlayers[i + 1] || null; // If odd number, p2 gets a BYE

        matches.push({
            id: crypto.randomUUID(),
            round: 1,
            player1: p1,
            player2: p2,
            score1: 0, score2: 0,
            winner: p2 === null ? p1 : null,
            isBye: p2 === null
        });
    }

    return {
        type: "swiss",
        totalRounds: maxRounds,
        rounds: [matches],
        pastMatchups: [], // Track who played who
        isComplete: false
    };
}

export async function advanceStage(stageData, config, allPlayers) {
    const currentRoundNum = stageData.rounds.length;
    const lastRound = stageData.rounds[currentRoundNum - 1];

    if (!stageData.playersWithByes) stageData.playersWithByes = [];
    if (!stageData.playedBitmasks) stageData.playedBitmasks = {};
    if (!stageData.pastMatchups) stageData.pastMatchups = [];

    // Track completed round matchups
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

    // 1. PIPELINE: Fisher-Yates -> Sort by Pairing Basis -> Tiebreakers
    const isFY = config.orderMode !== "og";
    if (isFY) fisherYatesShuffle(playersToPair);

    // Determine active tiebreaker rules for matchmaking
    let pairingRules;
    if (config.inheritTiebreakers !== false) {
        pairingRules = config.tiebreakers || ["points", "buchholz", "game_differential", "head_to_head", "seed"]; //will prob remove ts
    } else {
        pairingRules = config.pairingTiebreakers || ["points"];
    }

    // Ensure primary basis is the first rule in the waterfall
    const basis = config.swissPairingBasis || "match_points";
    const primaryRule = basis === "game_points" ? "game_points" : (basis === "dpw_rating" ? "dpw_rating" : "points");
    pairingRules = [primaryRule, ...pairingRules.filter(r => r !== primaryRule)];

    const sortFn = calculateTiebreakers(allPlayers, [ { data: stageData, config: config } ]);
    playersToPair.sort((a, b) => sortFn(a, b, pairingRules));

    // 2. Odd player count: append Dummy Bye Player™
    const isOdd = (playersToPair.length % 2 !== 0);
    const hasDummy = isOdd && config.pairingAlgorithm !== "plain_greedy";
    
    let pairingPool = [...playersToPair];
    let dummyIndex = -1;

    if (hasDummy) {
        dummyIndex = pairingPool.length;
        pairingPool.push({ id: "__BYE_DUMMY__", name: "BYE", isDummy: true, stats: { points: -99999 } });
    }

    const N = pairingPool.length;
    const W = Math.ceil(N / 64);
    const ranks = Array.from({ length: N }, (_, i) => i);
    const playedMatrix = Array.from({ length: N }, () => new Array(W).fill(0n));

    // Populate played bitmasks
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

    // 3. Plain Greedy forward-scan handling for Byes
    if (isOdd && config.pairingAlgorithm === "plain_greedy") {
        let byePlayer = null;
        for (let i = playersToPair.length - 1; i >= 0; i--) {
            if (!stageData.playersWithByes.includes(playersToPair[i].id)) {
                byePlayer = playersToPair[i];
                break;
            }
        }
        if (!byePlayer) byePlayer = playersToPair[playersToPair.length - 1];
        playersToPair = playersToPair.filter(p => p.id !== byePlayer.id);
    }

    // 4. Request WASM Matchmaking
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
        playedMatrix: playedMatrix.map(row => row.map(w => w.toString())) // safe serialization
    };

    let result = await requestMatchmaking(matchmakerParams);

    // 5. Handle Search Limit Hit / Timeout
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
                    stageData.passiveCDCL = true; // Switch CDCL to passive mode
                    resolve({ status: 0, pairCount: doomedPairs.length, pairs: doomedPairs });
                },
                onManualPair: (manualPairs) => {
                    stageData.passiveCDCL = true;
                    resolve({ status: 0, pairCount: manualPairs.length, pairs: manualPairs });
                }
            });
        });
    }

    // 6. Build next round's match objects
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

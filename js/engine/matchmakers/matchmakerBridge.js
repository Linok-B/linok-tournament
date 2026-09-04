import { startLoading, stopLoading } from '../../ui/spinner.js';

let worker1 = null;
let worker2 = null;
let currentRequestId = 0;
let proverRequestId = 0;
const pendingRequests = new Map();
const pendingProverRequests = new Map();

function getWorker1() {
    if (!worker1) {
        worker1 = new Worker('./js/engine/matchmakers/matchmakerWorker.js');
        worker1.onmessage = (e) => {
            const { id, success, status, pairCount, pairs, error } = e.data;
            const resolver = pendingRequests.get(id);
            if (resolver) {
                if (!success) {
                    pendingRequests.delete(id);
                    resolver.reject(new Error(error));
                } else {
                    resolver.handleWorker1Response({ status, pairCount, pairs });
                }
            }
        };
    }
    return worker1;
}

function getWorker2() {
    if (!worker2) {
        worker2 = new Worker('./js/engine/matchmakers/satProverWorker.js');
        worker2.onmessage = (e) => {
            const { id, success, status, error } = e.data;
            const resolver = pendingProverRequests.get(id);
            if (resolver) {
                pendingProverRequests.delete(id);
                if (success) resolver.resolve(status);
                else resolver.reject(new Error(error));
            }
        };
    }
    return worker2;
}

export async function requestMatchmaking(params) {
    startLoading("Computing Swiss Pairings...", 250);

    const reqId = ++currentRequestId;
    const w1 = getWorker1();
    const w2 = getWorker2();

    return new Promise((resolve, reject) => {
        let candidateOffset = 0;
        const d = params.n - params.currentRound;
        const midThresh = params.midDegreeThreshold !== undefined ? params.midDegreeThreshold : 6;

        const cleanup = () => {
            pendingRequests.delete(reqId);
            stopLoading();
        };

        const handleWorker1Response = async (res) => {
            // Status 6: Candidate needs dual check by Worker 2
            if (res.status === 6) {
                const proverId = ++proverRequestId;
                const checkType = d > midThresh ? 'SAT_HUNT' : 'CDCL_PROVE';

                const proverPromise = new Promise((pRes, pRej) => {
                    pendingProverRequests.set(proverId, { resolve: pRes, reject: pRej });
                });

                w2.postMessage({
                    id: proverId,
                    type: checkType,
                    n: params.n,
                    d: d,
                    playedMatrix: params.playedMatrix,
                    pairs: res.pairs,
                    maxFlips: params.microHuntBudget || 8000,
                    maxConflicts: 50000
                });

                const proverStatus = await proverPromise;

                if (proverStatus === 0) {
                    // SAT Confirmed -> Accept pairing
                    cleanup();
                    resolve({ status: 0, pairCount: res.pairCount, pairs: res.pairs });
                } else {
                    // UNSAT or Inconclusive -> Tell Worker 1 to advance to the next candidate
                    candidateOffset++;
                    w1.postMessage({ id: reqId, ...params, candidateOffset });
                }
                return;
            }

            // Conclusive exit status from Worker 1 (0, 1, 3, 4, 5)
            cleanup();
            resolve(res);
        };

        pendingRequests.set(reqId, {
            handleWorker1Response,
            reject: (err) => {
                cleanup();
                reject(err);
            }
        });

        w1.postMessage({ id: reqId, ...params, candidateOffset: 0 });
    });
}

export function preloadEngine(engineType) {
    getWorker1().postMessage({ type: 'PRELOAD', engineType });
    getWorker2().postMessage({ type: 'PRELOAD' });
}

export function preloadAllEngines() {
    getWorker1().postMessage({ type: 'PRELOAD', engineType: 'all' });
    getWorker2().postMessage({ type: 'PRELOAD' });
}

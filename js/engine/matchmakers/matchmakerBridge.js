import { startLoading, stopLoading } from '../../ui/spinner.js';

/*
lore:
by forcing `midDegreeThreshold: 0` from here, Worker 1 is
forced into running only the quick SAT huntm, and if inconclusive, it yields the candidate
immediately with status 6 instead of blocking in its internal synch CDCL.
Candidate verification runs the CDCL Prover and the Full SAT
Hunter concurrently in separate WebWorkers. First conclusive status wins, as originally intended.
Terminating a hung CDCL worker, due to browserslop, requires its termination, so to prevent
paying the re-compilation latency, a warm hot-spare CDCL worker is kept on standby.
If the candidate is found near the end of the search budget,
verification gets its own independent grace window so candidates are never dropped mid-check.
Note to myself: These JS orchestration tricks should eventually be replaced by native behavior of the cpp logic.
*/

let worker1 = null;
let cdclActive = null;
let cdclSpare = null;
let satHunter = null;

let currentRequestId = 0;
let proverRequestId = 0;

const pendingRequests = new Map();
const pendingProverCallbacks = new Map();

function killWorker(w) {
    if (w) {
        try { w.terminate(); } catch (e) {}
    }
}

function createMatchmakerWorker() {
    const w = new Worker('./js/engine/matchmakers/matchmakerWorker.js');
    w.onmessage = (e) => {
        const { id, success, status, pairCount, pairs, error } = e.data;
        const handler = pendingRequests.get(id);
        if (handler) {
            if (!success) handler.reject(new Error(error));
            else handler.onMessage({ status, pairCount, pairs });
        }
    };
    return w;
}

function createProverWorker() {
    const w = new Worker('./js/engine/matchmakers/satProverWorker.js');
    w.onmessage = (e) => {
        const { id, success, status, error } = e.data;
        const cb = pendingProverCallbacks.get(id);
        if (cb) {
            pendingProverCallbacks.delete(id);
            if (!success) cb.reject(new Error(error));
            else cb.resolve(status);
        }
    };
    return w;
}

function getWorker1() {
    if (!worker1) worker1 = createMatchmakerWorker();
    return worker1;
}

function getCDCLActive() {
    if (!cdclActive) cdclActive = createProverWorker();
    return cdclActive;
}

function getCDCLSpare() {
    if (!cdclSpare) {
        cdclSpare = createProverWorker();
        cdclSpare.postMessage({ type: 'PRELOAD' });
    }
    return cdclSpare;
}

function getSATHunter() {
    if (!satHunter) satHunter = createProverWorker();
    return satHunter;
}

function reWarmSpareCDCL() {
    killWorker(cdclSpare);
    cdclSpare = createProverWorker();
    cdclSpare.postMessage({ type: 'PRELOAD' });
}

function reWarmSATHunter() {
    killWorker(satHunter);
    satHunter = createProverWorker();
    satHunter.postMessage({ type: 'PRELOAD' });
}

function promoteSpareCDCL() {
    killWorker(cdclActive);
    cdclActive = cdclSpare || createProverWorker();
    cdclSpare = null;
    reWarmSpareCDCL();
}

export async function requestMatchmaking(params) {
    startLoading("Computing Swiss Pairings...", 250);

    const reqId = ++currentRequestId;
    const w1 = getWorker1();
    getCDCLActive();
    getCDCLSpare();
    getSATHunter();

    return new Promise((resolve, reject) => {
        let isDone = false;
        let candidateOffset = params.candidateOffset || 0;
        let firstCandidate = null;
        let bestInconclusiveCandidate = null;
        
        let searchTimer = null;
        let verifyTimer = null;

        const cleanupTimers = () => {
            if (searchTimer) clearTimeout(searchTimer);
            if (verifyTimer) clearTimeout(verifyTimer);
            searchTimer = null;
            verifyTimer = null;
        };

        const finish = (result) => {
            if (isDone) return;
            isDone = true;
            cleanupTimers();
            pendingRequests.delete(reqId);
            stopLoading();
            resolve(result);
        };

        // Watchdoggo
        const searchTimeoutMs = (params.timeoutMs || 5000);
        searchTimer = setTimeout(() => {
            if (!firstCandidate && !bestInconclusiveCandidate) {
                // Completely timed out with zero candidates found
                killWorker(worker1);
                worker1 = null;
                finish({ status: 5, pairCount: 0, pairs: [] });
            }
            // If candidates exist, let verification grace window conclude naturally
        }, searchTimeoutMs + 1000);

        // Runs parallel verification race on candidate k
        const verifyCandidateParallel = async (candidatePairs) => {
            const d = params.n - params.currentRound;
            const cdclId = ++proverRequestId;
            const satId = ++proverRequestId;

            let cdclSettled = false;
            let satSettled = false;
            let cdclResult = 2; // Default inconclusive
            let satResult = 2;

            // Start candidate verification timer of 1500ms
            if (verifyTimer) clearTimeout(verifyTimer);
            verifyTimer = setTimeout(() => {
                if (!cdclSettled) {
                    // CDCL timed out, so kill it
                    promoteSpareCDCL();
                    cdclSettled = true;
                    cdclResult = 2;
                }
            }, 1500);

            return new Promise((vResolve) => {
                const checkVerdict = () => {
                    // Immediate SAT confirmed by EITHER worker
                    if (cdclResult === 0 || satResult === 0) {
                        vResolve(0);
                        return;
                    }
                    // CDCL confirmed UNSAT -> Candidate is dead
                    if (cdclResult === 1) {
                        vResolve(1);
                        return;
                    }
                    // oth finished and are inconclusive
                    if (cdclSettled && satSettled) {
                        vResolve(2);
                    }
                };

                // Start CDCL Prover
                pendingProverCallbacks.set(cdclId, {
                    resolve: (status) => {
                        cdclSettled = true;
                        cdclResult = status;
                        checkVerdict();
                    },
                    reject: () => {
                        // Crashed/pathological candidate in CDCL: swap spare, mark inconclusive
                        promoteSpareCDCL();
                        cdclSettled = true;
                        cdclResult = 2;
                        checkVerdict();
                    }
                });

                cdclActive.postMessage({
                    id: cdclId,
                    type: 'CDCL_PROVE',
                    n: params.n,
                    d: d,
                    playedMatrix: params.playedMatrix,
                    pairs: candidatePairs,
                    maxConflicts: 50000
                });

                // Start SAT Hunter
                pendingProverCallbacks.set(satId, {
                    resolve: (status) => {
                        satSettled = true;
                        satResult = status;
                        checkVerdict();
                    },
                    reject: () => {
                        reWarmSATHunter();
                        satSettled = true;
                        satResult = 2;
                        checkVerdict();
                    }
                });

                satHunter.postMessage({
                    id: satId,
                    type: 'SAT_HUNT',
                    n: params.n,
                    d: d,
                    playedMatrix: params.playedMatrix,
                    pairs: candidatePairs,
                    maxFlips: 30000
                });
            });
        };

        const handleWorker1Response = async (res) => {
            try {
                // Status 6: Worker 1 yielded the candidate for verification
                if (res.status === 6) {
                    if (!firstCandidate) firstCandidate = res.pairs;

                    const verdict = await verifyCandidateParallel(res.pairs);

                    if (verdict === 0) {
                        // SAT Confirmed
                        finish({ status: 0, pairCount: res.pairs.length, pairs: res.pairs });
                        return;
                    }

                    if (verdict === 1) {
                        // CDCL proved UNSAT
                        candidateOffset++;
                        w1.postMessage({ id: reqId, ...params, candidateOffset });
                        return;
                    }

                    // 2 is inconclusive
                    if (!bestInconclusiveCandidate) bestInconclusiveCandidate = res.pairs;
                    candidateOffset++;
                    
                    // If candidate limit or search budget reached, conclude with inconclusive status
                    if (candidateOffset >= (params.maxCandidates || 100)) {
                        finish({ status: 2, pairCount: bestInconclusiveCandidate.length, pairs: bestInconclusiveCandidate });
                        return;
                    }

                    // Otherwise, ask Worker 1 for next cand
                    w1.postMessage({ id: reqId, ...params, candidateOffset });
                    return;
                }

                // worker 1 already proved sat by luckl
                if (res.status === 0) {
                    finish(res);
                    return;
                }

                // Status 4 or 3 or 5
                if (bestInconclusiveCandidate || firstCandidate) {
                    const fallbackPairs = bestInconclusiveCandidate || firstCandidate;
                    finish({ status: 2, pairCount: fallbackPairs.length, pairs: fallbackPairs, rawStatus: res.status });
                    return;
                }

                finish(res);
            } catch (err) {
                finish({ status: 5, pairCount: 0, pairs: [] });
            }
        };

        pendingRequests.set(reqId, {
            onMessage: handleWorker1Response,
            reject: (err) => finish({ status: 5, pairCount: 0, pairs: [] })
        });

        // Start Worker 1
        w1.postMessage({ id: reqId, ...params, candidateOffset });
    });
}

export function preloadEngine(engineType) {
    getWorker1().postMessage({ type: 'PRELOAD', engineType });
    getCDCLActive().postMessage({ type: 'PRELOAD' });
    getCDCLSpare();
    getSATHunter().postMessage({ type: 'PRELOAD' });
}

export function preloadAllEngines() {
    getWorker1().postMessage({ type: 'PRELOAD', engineType: 'all' });
    getCDCLActive().postMessage({ type: 'PRELOAD' });
    getCDCLSpare();
    getSATHunter().postMessage({ type: 'PRELOAD' });
}

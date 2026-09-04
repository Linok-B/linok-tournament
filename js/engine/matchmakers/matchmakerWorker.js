let mrvModule = null;
let greedyModule = null;
let blossomsModule = null;
let dutchModule = null;

// import scripts dynamically in worker
self.importScripts(
    './modules/mrv_cdcl_module.js',
    './modules/greedy_cdcl_module.js',
    './modules/blossoms_cdcl_module.js',
    './modules/dutch_solver_module.js'
);

async function getEngine(engineType) {
    const moduleOptions = {
        locateFile: (path) => `./modules/${path}`
    };

    if (engineType === 'mrv') {
        if (!mrvModule) mrvModule = await createMRVModule(moduleOptions);
        return mrvModule;
    }
    if (engineType === 'greedy' || engineType === 'plain_greedy') {
        if (!greedyModule) greedyModule = await createGreedyModule(moduleOptions);
        return greedyModule;
    }
    if (engineType === 'blossom' || engineType === 'topk_blossom') {
        if (!blossomsModule) blossomsModule = await createBlossomsModule(moduleOptions);
        return blossomsModule;
    }
    if (engineType === 'dutch') {
        if (!dutchModule) dutchModule = await createDutchModule(moduleOptions);
        return dutchModule;
    }
    throw new Error(`Unknown engine type: ${engineType}`);
}

const preloadedSet = new Set();

self.onmessage = async (e) => {
    // 1. Handle background preloading
    if (e.data.type === 'PRELOAD') {
        const target = e.data.engineType;
        try {
            if (target === 'all') {
                await Promise.all([getEngine('mrv'), getEngine('greedy'), getEngine('blossom'), getEngine('dutch')]);
            } else if (!preloadedSet.has(target)) {
                preloadedSet.add(target);
                await getEngine(target);
            }
        } catch (err) {}
        return;
    }

    // 2. Standard matchmaking dispatch
    const {
        id, n, engineType, isTopK, allowBacktrack, checkUpToDegree, midDegreeThreshold,
        maxCandidates, currentRound, microHuntBudget, candidateOffset, ranks,
        playedMatrix, scores, colorHistory, maxSearchNodes, timeoutMs
    } = e.data;
    
    try {
        const wasm = await getEngine(engineType);
        
        // Dynamic buffer allocation
        if (engineType === 'dutch') {
            wasm._configure(n, currentRound);
        } else {
            wasm._configure(n);
        }

        const view = new DataView(wasm.HEAPU8.buffer);
        const W = wasm._get_words_per_row(n);
        const ranksPtr = wasm._get_in_ranks();
        const playedPtr = wasm._get_in_played();

        for (let i = 0; i < n; i++) view.setInt32(ranksPtr + i * 4, ranks[i], true);
        for (let i = 0; i < n; i++) {
            for (let w = 0; w < W; w++) {
                const val = (playedMatrix[i] && playedMatrix[i][w]) ? BigInt(playedMatrix[i][w]) : 0n;
                view.setBigUint64(playedPtr + (i * W + w) * 8, val, true);
            }
        }

        // extra slop for (ass) Dutch
        if (engineType === 'dutch') {
            const scoresPtr = wasm._get_in_scores();
            const historyPtr = wasm._get_in_color_history();
            for (let i = 0; i < n; i++) {
                view.setInt32(scoresPtr + i * 4, scores ? (scores[i] || 0) : 0, true);
                const hist = (colorHistory && colorHistory[i]) ? colorHistory[i] : [];
                for (let r = 0; r < hist.length; r++) {
                    view.setInt32(historyPtr + (i * currentRound + r) * 4, hist[r] || 0, true);
                }
            }
        }

        // WASM Dispatch with parameterized thresholds
        let returnStatus = 0;
        const midThresh = midDegreeThreshold !== undefined ? midDegreeThreshold : 6;
        const microBudget = microHuntBudget !== undefined ? microHuntBudget : 8000;
        const offset = candidateOffset || 0;

        if (engineType === 'mrv') {
            returnStatus = wasm._run_mrv_matchmaker(
                n, checkUpToDegree, midThresh, maxCandidates, currentRound,
                microBudget, offset, maxSearchNodes || 0n, timeoutMs || 0.0
            );
        } else if (engineType === 'greedy' || engineType === 'plain_greedy') {
            returnStatus = wasm._run_greedy_matchmaker(
                n, allowBacktrack ? 1 : 0, checkUpToDegree, midThresh, maxCandidates,
                currentRound, microBudget, offset, maxSearchNodes || 0n, timeoutMs || 0.0
            );
        } else if (engineType === 'blossom' || engineType === 'topk_blossom') {
            returnStatus = wasm._run_blossoms_matchmaker(
                n, isTopK ? 1 : 0, checkUpToDegree, midThresh, maxCandidates,
                currentRound, microBudget, offset
            );
        } else if (engineType === 'dutch') {
            const isFinal = (currentRound === n - 1) ? 1 : 0;
            const topThreshold = (2 * (currentRound - 1)) / 2;
            returnStatus = wasm._run_dutch_matchmaker(n, currentRound, isFinal, topThreshold);
        }

        const outPtr = wasm._get_out_buffer();
        const outView = new DataView(wasm.HEAPU8.buffer);
        const status = outView.getInt32(outPtr, true);
        const pairCount = outView.getInt32(outPtr + 4, true);
        const pairs = [];

        for (let i = 0; i < pairCount; i++) {
            pairs.push([
                outView.getInt32(outPtr + 8 + i * 8, true),
                outView.getInt32(outPtr + 12 + i * 8, true)
            ]);
        }

        self.postMessage({ id, success: true, status, pairCount, pairs });
    } catch (err) {
        self.postMessage({ id, success: false, error: err.message });
    }
};

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
                await Promise.all([
                    getEngine('mrv'),
                    getEngine('greedy'),
                    getEngine('blossom'),
                    getEngine('dutch')
                ]);
            } else if (!preloadedSet.has(target)) {
                preloadedSet.add(target);
                await getEngine(target);
            }
        } catch (err) {}
        return;
    }

    // 2. Standard matchmaking dispatch
    const { id, n, engineType, isTopK, allowBacktrack, checkUpToDegree, maxCandidates, currentRound, ranks, playedMatrix, scores, colorHistory } = e.data;

    try {
        const wasm = await getEngine(engineType);
        
        // 1. Prepare dynamic buffers for exact N
        wasm._prepare_buffers(n);

        const buffer = wasm.HEAPU8.buffer;
        const view = new DataView(buffer);
        const W = Math.ceil(n / 64);

        const ranksPtr = wasm._get_in_ranks();
        const playedPtr = wasm._get_in_played();

        for (let i = 0; i < n; i++) view.setInt32(ranksPtr + i * 4, ranks[i], true);
        for (let i = 0; i < n; i++) {
            for (let w = 0; w < W; w++) {
                const val = (playedMatrix[i] && playedMatrix[i][w]) ? BigInt(playedMatrix[i][w]) : 0n;
                view.setBigUint64(playedPtr + (i * W + w) * 8, val, true);
            }
        }

        // 2. extra slop for (ass) Dutch
        if (engineType === 'dutch') {
            const scoresPtr = wasm._get_in_scores();
            const historyPtr = wasm._get_in_color_history();
            for (let i = 0; i < n; i++) {
                view.setInt32(scoresPtr + i * 4, scores[i] || 0, true);

                const hist = (colorHistory && colorHistory[i]) ? colorHistory[i] : [];
                let w_cnt = 0, b_cnt = 0;
                for (let c of hist) {
                    if (c === 1) w_cnt++;
                    else if (c === 2) b_cnt++;
                }

                let streak = 0;
                let last_color = 0;
                if (hist.length > 0) {
                    last_color = hist[hist.length - 1];
                    for (let r = hist.length - 1; r >= 0; r--) {
                        if (hist[r] === last_color) streak++;
                        else break;
                    }
                }

                view.setInt32(historyPtr + (i * 4 + 0) * 4, w_cnt, true);
                view.setInt32(historyPtr + (i * 4 + 1) * 4, b_cnt, true);
                view.setInt32(historyPtr + (i * 4 + 2) * 4, streak, true);
                view.setInt32(historyPtr + (i * 4 + 3) * 4, last_color, true);
            }
        }

        // 3. Dispatch WASM
        let returnStatus = 0;
        if (engineType === 'mrv') {
            returnStatus = wasm._run_mrv_matchmaker(n, checkUpToDegree, maxCandidates, currentRound);
        } else if (engineType === 'greedy' || engineType === 'plain_greedy') {
            returnStatus = wasm._run_greedy_matchmaker(n, allowBacktrack ? 1 : 0, checkUpToDegree, maxCandidates, currentRound);
        } else if (engineType === 'blossom' || engineType === 'topk_blossom') {
            returnStatus = wasm._run_blossoms_matchmaker(n, isTopK ? 1 : 0, checkUpToDegree, maxCandidates, currentRound);
        } else if (engineType === 'dutch') {
            const isFinal = (currentRound === n - 1) ? 1 : 0;
            const topThreshold = (2 * (currentRound - 1)) / 2;
            returnStatus = wasm._run_dutch_matchmaker(n, currentRound, isFinal, topThreshold);
        }

        // 4. Read Output
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

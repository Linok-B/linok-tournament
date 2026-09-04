let proverModule = null;

self.importScripts('./modules/sat_prover_module.js');

async function getProver() {
    if (!proverModule) {
        proverModule = await createSatProverModule({
            locateFile: (path) => `./modules/${path}`
        });
    }
    return proverModule;
}

self.onmessage = async (e) => {
    const { id, type, n, d, playedMatrix, pairs, maxFlips, maxConflicts } = e.data;

    if (type === 'PRELOAD') {
        try { await getProver(); } catch (err) {}
        return;
    }

    try {
        const wasm = await getProver();
        wasm._configure(n);

        const W = wasm._get_words_per_row(n);
        const playedPtr = wasm._get_in_played();
        const pairsPtr = wasm._get_in_candidate_pairs();
        const view = new DataView(wasm.HEAPU8.buffer);

        // 1. Write played bitmatrix
        for (let i = 0; i < n; i++) {
            for (let w = 0; w < W; w++) {
                const val = (playedMatrix[i] && playedMatrix[i][w]) ? BigInt(playedMatrix[i][w]) : 0n;
                view.setBigUint64(playedPtr + (i * W + w) * 8, val, true);
            }
        }

        // 2. Write candidate pairs [u1, v1, u2, v2, ...]
        for (let i = 0; i < pairs.length; i++) {
            view.setInt32(pairsPtr + (i * 2) * 4, pairs[i][0], true);
            view.setInt32(pairsPtr + (i * 2 + 1) * 4, pairs[i][1], true);
        }

        // 3. Dispatch requested task
        let status = 2; // 0 = SAT_CONFIRMED, 1 = UNSAT_PROVEN, 2 = INCONCLUSIVE
        if (type === 'SAT_HUNT') {
            status = wasm._run_sat_hunter(n, d, maxFlips || 8000);
        } else if (type === 'CDCL_PROVE') {
            status = wasm._run_cdcl_prover(n, d, maxConflicts || 50000);
        }

        self.postMessage({ id, success: true, status });
    } catch (err) {
        self.postMessage({ id, success: false, error: err.message });
    }
};

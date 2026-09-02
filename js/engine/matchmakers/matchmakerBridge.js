import { startLoading, stopLoading } from '../../ui/spinner.js';

let worker = null;
let currentRequestId = 0;
const pendingRequests = new Map();

function getWorker() {
    if (!worker) {
        worker = new Worker('./js/engine/matchmakers/matchmakerWorker.js');
        worker.onmessage = (e) => {
            const { id, success, status, pairCount, pairs, error } = e.data;
            const resolver = pendingRequests.get(id);
            if (resolver) {
                pendingRequests.delete(id);
                if (success) resolver.resolve({ status, pairCount, pairs });
                else resolver.reject(new Error(error));
            }
        };
    }
    return worker;
}

export async function requestMatchmaking(params) {
    startLoading("Computing Swiss Pairings...", 250);

    const reqId = ++currentRequestId;
    const workerInstance = getWorker();

    return new Promise((resolve, reject) => {
        pendingRequests.set(reqId, {
            resolve: (res) => {
                stopLoading();
                resolve(res);
            },
            reject: (err) => {
                stopLoading();
                reject(err);
            }
        });

        workerInstance.postMessage({ id: reqId, ...params });
    });
}

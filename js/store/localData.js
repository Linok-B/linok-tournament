import { openDB, performTransaction } from './db.js';

const LEGACY_STORAGE_KEY = 'tournament_state';
const UI_STORAGE_KEY = 'tournament_ui';

// Sync theme to localStorage solely for index.html head anti-flash
export function syncUIToLocalStorage(uiSettings) {
    if (!uiSettings) return;
    try {
        localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch (e) {}
}

// autosave working tournament
export async function saveTournamentLocally(tournamentObject) {
    if (!tournamentObject) return;

    // Stamp ID and modified timestamp if missing
    if (!tournamentObject.id) tournamentObject.id = crypto.randomUUID();
    tournamentObject.updatedAt = Date.now();

    // Cache theme for index.html head script
    if (tournamentObject.settings?.ui) {
        syncUIToLocalStorage(tournamentObject.settings.ui);
    }

    const writeOp = () => performTransaction('active_workspace', 'readwrite', (store) => {
        return store.put({ key: 'current', tournament: tournamentObject });
    });

    try {
        await writeOp();
    } catch (err) {
        if (isQuotaError(err)) {
            console.warn("[Storage] QuotaExceededError hit. Attempting to release emergency buffer...");
            const freed = await releaseEmergencyBuffer();
            if (freed) {
                await writeOp();
                alert(
                    "CRITICAL STORAGE WARNING:\n\n" +
                    "Your device ran out of storage space!\n" +
                    "The Emergency Reserve Quota was sacrificed to safely save your tournament.\n\n" +
                    "Action Required: Export your tournament to a file immediately and delete old tournaments from the Library to clear space."
                );
            } else {
                alert("CRITICAL STORAGE ERROR: Device storage is completely full and no emergency buffer was available. Please export a backup JSON now before closing this tab!");
                throw err;
            }
        } else {
            throw err;
        }
    }

    const autoSaveSetting = await getAppMeta('autoSaveToLibrary');
    if (autoSaveSetting === true) {
        await saveTournamentToLibrary(tournamentObject);
    }
}

// load active working yournament
export async function loadTournamentLocally() {
    await openDB();

    // Check IndexedDB active workspace first
    const record = await performTransaction('active_workspace', 'readonly', (store) => {
        return store.get('current');
    });

    if (record && record.tournament) {
        return record.tournament;
    }

    // check old localStorage slop
    try {
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
            const parsed = JSON.parse(legacyData);
            if (!parsed.id) parsed.id = crypto.randomUUID();
            parsed.updatedAt = Date.now();

            // save to new indexedDB active workspace
            await performTransaction('active_workspace', 'readwrite', (store) => {
                return store.put({ key: 'current', tournament: parsed });
            });

            // cche theme and clean up bloated localStorage key
            if (parsed.settings?.ui) syncUIToLocalStorage(parsed.settings.ui);
            localStorage.removeItem(LEGACY_STORAGE_KEY);

            return parsed;
        }
    } catch (e) {
        console.warn('Failed to parse legacy localStorage state:', e);
    }

    return null;
}

export async function clearLocalData() {
    await performTransaction('active_workspace', 'readwrite', (store) => {
        return store.delete('current');
    });
}

// tourney lib op
export async function saveTournamentToLibrary(tournamentObject) {
    if (!tournamentObject) return;
    const clone = JSON.parse(JSON.stringify(tournamentObject));
    if (!clone.id) clone.id = crypto.randomUUID();
    clone.updatedAt = Date.now();

    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('library', 'readwrite');
        const store = tx.objectStore('library');

        const getReq = store.get(clone.id);
        getReq.onsuccess = () => {
            const existing = getReq.result;
            if (existing && existing.order !== undefined) {
                // retain existing position
                clone.order = existing.order;
                store.put(clone);
            } else {
                // place new tourneys at the top
                const allReq = store.getAll();
                allReq.onsuccess = () => {
                    const all = allReq.result || [];
                    all.forEach(t => {
                        t.order = (t.order !== undefined ? t.order : 0) + 1;
                        store.put(t);
                    });
                    clone.order = 0;
                    store.put(clone);
                };
            }
        };

        tx.oncomplete = () => resolve(clone.id);
        tx.onerror = () => reject(tx.error);
    });
}

export async function getLibraryTournaments() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction('library', 'readonly');
            const store = tx.objectStore('library');
            const req = store.getAll();
            req.onsuccess = () => {
                const list = req.result || [];
                list.sort((a, b) => {
                    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                    if (a.order !== undefined) return -1;
                    if (b.order !== undefined) return 1;
                    return (b.updatedAt || 0) - (a.updatedAt || 0);
                });
                resolve(list);
            };
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

export async function getTournamentFromLibrary(id) {
    return performTransaction('library', 'readonly', (store) => store.get(id));
}

export async function deleteTournamentFromLibrary(id) {
    return performTransaction('library', 'readwrite', (store) => store.delete(id));
}

// metadata get & set
export async function getAppMeta(key) {
    const record = await performTransaction('app_meta', 'readonly', (store) => store.get(key));
    return record ? record.value : undefined;
}

export async function setAppMeta(key, value) {
    return performTransaction('app_meta', 'readwrite', (store) => store.put({ key, value }));
}

export async function updateLibraryOrder(orderedIds) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('library', 'readwrite');
        const store = tx.objectStore('library');
        orderedIds.forEach((id, index) => {
            const req = store.get(id);
            req.onsuccess = () => {
                if (req.result) {
                    req.result.order = index;
                    store.put(req.result);
                }
            };
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}


// emergency storage buffer (quota reserve) system
const BUFFER_SIZE_KB = 1024;

function isQuotaError(err) {
    if (!err) return false;
    return err.name === 'QuotaExceededError' ||
           err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           err.code === 22 ||
           (typeof err.message === 'string' && err.message.toLowerCase().includes('quota'));
}

export async function ensureEmergencyBuffer() {
    try {
        const existing = await performTransaction('app_meta', 'readonly', (store) => store.get('emergency_buffer'));
        if (!existing) {
            // Pre-allocate dummy bytes
            const dummyBytes = new Uint8Array(BUFFER_SIZE_KB * 1024);
            await performTransaction('app_meta', 'readwrite', (store) => {
                return store.put({ key: 'emergency_buffer', data: dummyBytes, allocatedAt: Date.now() });
            });
            console.log(`[Storage] Emergency buffer armed (${BUFFER_SIZE_KB} KB allocated).`);
        }
    } catch (err) {
        if (isQuotaError(err)) {
            console.warn('[Storage] Quota too tight to arm emergency buffer.');
        } else {
            console.error('[Storage] Error ensuring emergency buffer:', err);
        }
    }
}

export async function releaseEmergencyBuffer() {
    try {
        const record = await performTransaction('app_meta', 'readonly', (store) => store.get('emergency_buffer'));
        if (record) {
            await performTransaction('app_meta', 'readwrite', (store) => store.delete('emergency_buffer'));
            console.warn(`[Storage] EMERGENCY BUFFER SACRIFICED: ${BUFFER_SIZE_KB} KB freed.`);
            return true;
        }
    } catch (e) {
        console.error('[Storage] Failed to release emergency buffer:', e);
    }
    return false;
}

export async function getEmergencyBufferStatus() {
    try {
        const record = await performTransaction('app_meta', 'readonly', (store) => store.get('emergency_buffer'));
        return {
            armed: !!record,
            sizeKB: record ? BUFFER_SIZE_KB : 0,
            allocatedAt: record ? record.allocatedAt : null
        };
    } catch (e) {
        return { armed: false, sizeKB: 0, allocatedAt: null };
    }
}

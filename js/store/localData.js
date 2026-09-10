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

    // Save to active workspace
    await performTransaction('active_workspace', 'readwrite', (store) => {
        return store.put({ key: 'current', tournament: tournamentObject });
    });

    // Check if autosave to lib toggle is enabled
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

    await performTransaction('library', 'readwrite', (store) => {
        return store.put(clone);
    });
    return clone.id;
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

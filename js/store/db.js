const DB_NAME = 'TournamentDB';
const DB_VERSION = 1;

let dbInstance = null;

export function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;

            // 1. Working workspace for the active tournament, single entry
            if (!db.objectStoreNames.contains('active_workspace')) {
                db.createObjectStore('active_workspace', { keyPath: 'key' });
            }

            // 2. Permanent tournament library, multi-entry
            if (!db.objectStoreNames.contains('library')) {
                const libraryStore = db.createObjectStore('library', { keyPath: 'id' });
                libraryStore.createIndex('name', 'settings.name', { unique: false });
                libraryStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // 3. Metadata store(age)
            if (!db.objectStoreNames.contains('app_meta')) {
                db.createObjectStore('app_meta', { keyPath: 'key' });
            }
        };

        req.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };

        req.onerror = (e) => {
            reject(new Error(`Failed to open IndexedDB: ${e.target.error}`));
        };
    });
}

// Trans helper
export async function performTransaction(storeName, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        const req = callback(store);

        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

const STORAGE_KEY = 'tournament_state';

export function saveTournamentLocally(tournamentObject) {
    // Convert the data to JSON and save it to the browser
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournamentObject));
}

export function loadTournamentLocally() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
}

export function clearLocalData() {
    localStorage.removeItem(STORAGE_KEY);
}

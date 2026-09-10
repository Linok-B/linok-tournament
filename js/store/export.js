export function exportTournamentJSON(tournamentObj) {
    // 1. Convert the active tournament object to a formatted JSON string
    const dataStr = JSON.stringify(tournamentObj, null, 2);
    
    // 2. Create a hidden, temporary Blob
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // 3. Create a temporary, invisible <a> tag
    const a = document.createElement("a");
    a.href = url;
    
    // Sanitize name
    let safeName = tournamentObj.settings.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    if (!safeName || safeName === '_') safeName = 'Tournament';
    
    const now = new Date();
    
    // Format Date: DD-MM-YYYY
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;
    
    // Format Time: HH-MM (24-hour format)
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}-${min}`;
    
    // Final Output Example: My_Custom_Tournament_25-10-2023_14-30.json
    a.download = `${safeName}_${dateStr}_${timeStr}.json`;
    
    document.body.appendChild(a);
    a.click();
    
    // 4. Clean up the memory
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

export function importTournamentJSON(file, callback) {
    // Read the uploaded file
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            callback(true, parsedData);
        } catch (error) {
            console.error("Failed to parse JSON", error);
            callback(false, "Invalid Tournament File. Ensure it is a valid .json export.");
        }
    };
    
    reader.readAsText(file);
}

export function exportTournamentBundleJSON(tournamentsArray, bundleName = "Tournament_Backup") {
    const bundle = {
        bundleVersion: 1,
        exportedAt: new Date().toISOString(),
        tournaments: tournamentsArray.map(t => {
            const copy = JSON.parse(JSON.stringify(t));
            if (!copy.id) copy.id = crypto.randomUUID();
            return copy;
        })
    };

    const dataStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const safeName = bundleName.replace(/[^a-zA-Z0-9-_]/g, '_') || "Tournament_Backup";
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

    a.download = `${safeName}_Bundle_${dd}-${mm}-${yyyy}_${time}.json`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

// Universal parser for all relevant slop
export function parseTournamentImportJSON(file, callback) {
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);

            // multi-tourney bundle spotted :o:
            if (parsed && Array.isArray(parsed.tournaments)) {
                const normalized = parsed.tournaments.map(t => {
                    if (!t.id) t.id = crypto.randomUUID();
                    return t;
                });
                return callback(true, { type: 'bundle', tournaments: normalized });
            }

            // Single tourney (old or new)
            if (parsed && (parsed.stages !== undefined || parsed.players !== undefined || parsed.settings !== undefined)) {
                if (!parsed.id) parsed.id = crypto.randomUUID();
                return callback(true, { type: 'single', tournament: parsed });
            }

            callback(false, "Unrecognized format. Please provide a valid single tournament or bundle JSON export.");
        } catch (err) {
            callback(false, "Invalid JSON file.");
        }
    };

    reader.readAsText(file);
}

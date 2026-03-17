export function exportTournamentJSON(tournamentObj) {
    // 1. Convert the active tournament object to a formatted JSON string
    const dataStr = JSON.stringify(tournamentObj, null, 2);
    
    // 2. Create a hidden, temporary Blob (a file-like object in memory)
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // 3. Create a temporary, invisible <a> tag and force a click to download
    const a = document.createElement("a");
    a.href = url;
    
    // Add the current date to the filename
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `Tournament_Export_${dateStr}.json`;
    
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

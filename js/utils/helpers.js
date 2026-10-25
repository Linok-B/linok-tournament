// HTML Sanitization for attributes and innerHTML
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// String truncation
export function trimName(name, maxLength = 13) {
    if (!name) return "TBD";
    return name.length > maxLength ? name.substring(0, maxLength) + "..." : name;
}

// Time formatter for my fellow humans
export function formatDuration(val) {
    if (isNaN(val) || val <= 0) return "5.00 seconds (Default)";
    if (val < 0.001) return `${(val * 1000000).toFixed(1)} ns`;
    if (val < 1) return `${(val * 1000).toFixed(1)} µs`;
    if (val < 1000) return `${val} ms`;
    if (val < 60000) return `${(val / 1000).toFixed(2)} seconds`;
    if (val < 3600000) return `${(val / 60000).toFixed(2)} minutes`;
    if (val < 86400000) return `${(val / 3600000).toFixed(2)} hours`;
    return `${(val / 86400000).toFixed(2)} days`;
}

// Parses "Name, ELO"
export function parsePlayerLine(line, defaultElo = 1200) {
    let nameChars = [];
    let delimiterIndex = -1;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escaped) {
            nameChars.push(char);
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        // Unescaped comma or tab acts as the delimiter
        if (char === ',' || char === '\t') {
            delimiterIndex = i;
            break;
        }
        nameChars.push(char);
    }
    const parsedName = nameChars.join('').trim();
    let parsedElo = parseInt(defaultElo, 10) || 1200;
    if (delimiterIndex !== -1) {
        const rest = line.slice(delimiterIndex + 1).trim();
        const customElo = parseInt(rest, 10);
        if (!isNaN(customElo)) {
            parsedElo = customElo;
        }
    }
    return { name: parsedName, elo: parsedElo };
}

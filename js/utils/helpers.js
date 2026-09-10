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

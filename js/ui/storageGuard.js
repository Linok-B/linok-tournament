import { getIcon } from './icons.js';
import { exportTournamentJSON } from '../store/export.js';
import { openTournamentLibraryModal } from './libraryModal.js';

// Configuration Thresholds
const THRESHOLDS = {
    TIER_1: { percent: 80, remainingMB: 60 },
    TIER_2: { percent: 90, remainingMB: 30 },
    TIER_3: { percent: 97, remainingMB: 5 }
};

// Sensible delta
const RETRIGGER_DELTA_PERCENT = 10;
const RETRIGGER_DELTA_BYTES = 30 * 1024 * 1024;

const MUTE_STORAGE_KEY = 'storage_guard_mute_state';

// Bounded ring buffer
const MAX_CHECKPOINTS = 6;
const checkpoints = [];

let activeModalOverlay = null;
let lastShownTier = 0;
let lastAlertSample = null;
let prevBeforeUnloadHandler = null;
let persistenceGranted = true;

// unit formatters
function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
    const abs = Math.abs(bytes);
    if (abs < 1024) return `${Math.round(abs)} B`;
    if (abs < 1024 * 1024) return `${(abs / 1024).toFixed(1)} KB`;
    if (abs < 1024 * 1024 * 1024) return `${(abs / (1024 * 1024)).toFixed(1)} MB`;
    return `${(abs / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimeSpan(ms) {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${Math.max(1, sec)} seconds`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} minutes`;
    const hrs = (min / 60).toFixed(1);
    return `${hrs} hours`;
}

function formatRate(bytesPerSec) {
    const abs = Math.abs(bytesPerSec);
    if (abs < 1024) return `${Math.round(abs)} B/s`;
    if (abs < 1024 * 1024) return `${(abs / 1024).toFixed(1)} KB/s`;
    const mbPerMin = (abs * 60) / (1024 * 1024);
    if (mbPerMin < 60) return `${mbPerMin.toFixed(1)} MB/min`;
    return `${(abs / (1024 * 1024)).toFixed(2)} MB/s`;
}

// Prevent tab close/reload while critical modal is active
function trapBeforeUnload() {
    if (prevBeforeUnloadHandler === null) {
        prevBeforeUnloadHandler = window.onbeforeunload;
        window.onbeforeunload = (e) => {
            e.preventDefault();
            return (e.returnValue = "Storage is critically low. Leaving may result in unrecoverable tournament data loss.");
        };
    }
}

function releaseBeforeUnload() {
    if (prevBeforeUnloadHandler !== null) {
        window.onbeforeunload = prevBeforeUnloadHandler;
        prevBeforeUnloadHandler = null;
    }
}

// Persistent storage elevation
export async function requestPersistentStorage() {
    try {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
                persistenceGranted = await navigator.storage.persist();
            } else {
                persistenceGranted = true;
            }
        }
    } catch (e) {
        persistenceGranted = false;
    }
}

// Calculate rate of change strictly from real historical deltas
function calculateRateOfChange(currentSample) {
    if (checkpoints.length < 2) {
        return null;
    }

    const oldest = checkpoints[0];
    const deltaBytes = currentSample.usage - oldest.usage; // Positive = usage grew (storage dropped)
    const elapsedMs = currentSample.time - oldest.time;

    if (elapsedMs < 2000) {
        return null;
    }

    const bytesPerSec = (deltaBytes / elapsedMs) * 1000;
    const absDelta = Math.abs(deltaBytes);

    if (absDelta < 100 * 1024) { // Under 100 KB is steady
        return `Storage remained steady over the last ~${formatTimeSpan(elapsedMs)}.`;
    }

    const directionText = deltaBytes > 0 ? "dropped by" : "increased by";
    return `Storage ${directionText} ~${formatBytes(absDelta)} in the last ~${formatTimeSpan(elapsedMs)} at a rate of ~${formatRate(bytesPerSec)}.`;
}

// Core Health Check
export async function checkStorageHealth(getTournament, { isStartup = false } = {}) {
    if (!navigator.storage || !navigator.storage.estimate) return;

    try {
        const { usage, quota } = await navigator.storage.estimate();
        if (!quota || quota <= 0) return;

        const remainingBytes = Math.max(0, quota - usage);
        const remainingMB = remainingBytes / (1024 * 1024);
        const percentUsed = (usage / quota) * 100;

        const currentSample = { time: Date.now(), usage, quota, percentUsed, remainingBytes, remainingMB };

        // Append to 6-point ring buffer
        checkpoints.push(currentSample);
        if (checkpoints.length > MAX_CHECKPOINTS) {
            checkpoints.shift();
        }

        // Determine severity tier
        let tier = 0;
        if (percentUsed >= THRESHOLDS.TIER_3.percent || remainingMB <= THRESHOLDS.TIER_3.remainingMB) {
            tier = 3;
        } else if (percentUsed >= THRESHOLDS.TIER_2.percent || remainingMB <= THRESHOLDS.TIER_2.remainingMB) {
            tier = 2;
        } else if (percentUsed >= THRESHOLDS.TIER_1.percent || remainingMB <= THRESHOLDS.TIER_1.remainingMB) {
            tier = 1;
        }

        // Safe zone recovery check: resets latch if space substantially recovers
        if (tier === 0) {
            lastShownTier = 0;
            return;
        }

        //  Check startup mute preference
        if (isStartup) {
            try {
                const muteData = JSON.parse(localStorage.getItem(MUTE_STORAGE_KEY) || '{}');
                if (muteData.muted) {
                    const deltaP = Math.abs(percentUsed - (muteData.percent || 0));
                    const deltaB = Math.abs(remainingBytes - (muteData.remainingBytes || 0));

                    // Stays silent unless storage shifted enough since mute
                    if (deltaP < RETRIGGER_DELTA_PERCENT && deltaB < RETRIGGER_DELTA_BYTES && tier === muteData.tier) {
                        return;
                    }
                }
            } catch (e) {}
        }

        // If the tier changed: trigger
        const tierChanged = tier !== lastShownTier;

        if (!tierChanged && lastAlertSample) {
            // Within the same tier only trigger if cumulative shift since last dismissal
            const deltaP = Math.abs(percentUsed - lastAlertSample.percentUsed);
            const deltaB = Math.abs(remainingBytes - lastAlertSample.remainingBytes);
            if (deltaP < RETRIGGER_DELTA_PERCENT && deltaB < RETRIGGER_DELTA_BYTES) {
                return;
            }
        }

        // Trigger the Warning Modal
        showStorageWarningModal(tier, currentSample, getTournament);

    } catch (e) {}
}

// Modal Presentation
function showStorageWarningModal(tier, sample, getTournament) {
    if (activeModalOverlay) return;

    trapBeforeUnload();

    const overlay = document.createElement('div');
    overlay.id = 'storage-warning-modal-overlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;";

    // User must choose an action
    overlay.onclick = (e) => {
        e.stopPropagation();
    };

    const modal = document.createElement('div');
    
    const tierColor = tier === 3 ? 'var(--danger)' : (tier === 2 ? 'var(--warning)' : 'var(--accent)');
    const tierTitle = tier === 3 ? 'CRITICAL STORAGE EMERGENCY' : (tier === 2 ? 'STORAGE WARNING: CRITICALLY LOW' : 'STORAGE ADVISORY');
    const tierIcon = tier === 3 ? getIcon('warning', 28) : (tier === 2 ? getIcon('warning', 26) : getIcon('archive', 24));

    modal.style.cssText = `background:var(--bg-panel); border:2px solid ${tierColor}; border-radius:8px; width:520px; max-width:92vw; padding:25px; display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box; color:var(--text-main);`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeModalOverlay = overlay;

    const rateSentence = calculateRateOfChange(sample);

    modal.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:12px;">
            <span style="color:${tierColor}; display:flex; align-items:center;">${tierIcon}</span>
            <h2 style="margin:0; color:${tierColor}; text-align:center; font-size:18px;">${tierTitle}</h2>
        </div>

        <div style="background:var(--bg-dark); padding:12px; border-radius:4px; border:1px solid var(--border-main); margin-bottom:14px; text-align:center;">
            <div style="font-size:16px; font-weight:bold; color:var(--text-main);">
                Storage is ~${sample.percentUsed.toFixed(1)}% full (~${formatBytes(sample.remainingBytes)} available)
            </div>
            ${rateSentence ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${rateSentence}</div>` : ''}
        </div>

        <div style="font-size:13px; line-height:1.5; color:var(--text-main); margin-bottom:14px;">
            Browser storage is tied directly to your device's physical hard drive. To free space and protect your data:
            <ul style="margin:6px 0 0 0; padding-left:20px; color:var(--text-muted); font-size:12px; line-height:1.6;">
                <li>Inside this app: Delete old tournaments in the <strong>Library</strong>.</li>
                <li>In your browser: Clear browser cache and storage for other websites.</li>
                <li>On your device: Free physical drive space (clear Downloads, empty Trash/Recycle Bin, delete large files or other app's data).</li>
            </ul>
        </div>

        ${!persistenceGranted ? `
            <div style="font-size:11px; color:var(--warning); background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:4px; border-left:3px solid var(--warning); margin-bottom:14px; line-height:1.4;">
                <strong>Note:</strong> Persistent storage permission was not granted by your browser. Under low device storage, the browser may automatically clear local tournament data without warning. Routine file exports are strongly advised.
            </div>
        ` : ''}

        ${tier >= 2 ? `
            <p style="font-size:12px; line-height:1.4; color:var(--danger); background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:4px; border-left:3px solid var(--danger); margin-top:0; margin-bottom:14px;">
                <strong>Warning:</strong> Completely exhausting physical disk space will cause this application and your operating system to freeze or crash.
            </p>
        ` : ''}

        <label class="custom-checkbox-label" style="margin-bottom:18px;">
            <input type="checkbox" id="chk-mute-startup">
            <span>Don't warn on startup unless storage shifts by ~${RETRIGGER_DELTA_PERCENT}% or ~${Math.round(RETRIGGER_DELTA_BYTES / (1024 * 1024))} MB</span>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-main); padding-top:14px; flex-wrap:wrap;">
            <button id="btn-storage-export" style="background:var(--success); color:var(--text-on-accent); border:none; padding:8px 14px; border-radius:4px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:12px;">
                ${getIcon('save', 14)} Export Active Tournament
            </button>
            <button id="btn-storage-library" style="background:var(--border-main); color:var(--text-main); border:none; padding:8px 14px; border-radius:4px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:12px;">
                ${getIcon('archive', 14)} Open Library
            </button>
            <button id="btn-storage-dismiss" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-main); padding:8px 16px; border-radius:4px; cursor:pointer; font-size:12px;">
                Dismiss
            </button>
        </div>
    `;

    // Button actions
    document.getElementById('btn-storage-export').onclick = () => {
        const tournament = typeof getTournament === 'function' ? getTournament() : null;
        if (tournament) exportTournamentJSON(tournament);
    };

    document.getElementById('btn-storage-library').onclick = () => {
        const tournament = typeof getTournament === 'function' ? getTournament() : null;
        if (tournament) {
            openTournamentLibraryModal(tournament, (switched) => {
                window.location.reload();
            });
        }
    };

    document.getElementById('btn-storage-dismiss').onclick = () => {
        const isMuteChecked = document.getElementById('chk-mute-startup').checked;
        if (isMuteChecked) {
            try {
                localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify({
                    muted: true,
                    tier: tier,
                    percent: sample.percentUsed,
                    remainingBytes: sample.remainingBytes,
                    time: Date.now()
                }));
            } catch (e) {}
        }

        lastShownTier = tier;
        lastAlertSample = sample;

        releaseBeforeUnload();
        overlay.remove();
        activeModalOverlay = null;
    };
}

export function initStorageGuard(getTournament) {
    requestPersistentStorage();
    // Check health on boot
    checkStorageHealth(getTournament, { isStartup: true });
}

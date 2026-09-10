import { getLibraryTournaments, getTournamentFromLibrary, saveTournamentToLibrary, deleteTournamentFromLibrary, saveTournamentLocally } from '../store/localData.js';
import { exportTournamentJSON, exportTournamentBundleJSON, parseTournamentImportJSON } from '../store/export.js';
import { getIcon } from './icons.js';

let activeModalOverlay = null;

export async function openTournamentLibraryModal(currentTournament, onSwitchTournament) {
    if (activeModalOverlay) activeModalOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'library-modal-overlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:10000; display:flex; justify-content:center; align-items:center;";

    const modal = document.createElement('div');
    modal.style.cssText = "background:var(--bg-panel); border:2px solid var(--accent); border-radius:8px; width:680px; max-width:92vw; padding:25px; display:flex; flex-direction:column; max-height:90vh; box-sizing:border-box; color:var(--text-main);";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeModalOverlay = overlay;

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
            activeModalOverlay = null;
        }
    };

    const selectedIds = new Set();
    let tournaments = await getLibraryTournaments();

    function render() {
        const hasTournaments = tournaments.length > 0;
        const allSelected = hasTournaments && tournaments.every(t => selectedIds.has(t.id));

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-main); padding-bottom:10px; margin-bottom:15px;">
                <h2 style="margin:0; color:var(--accent); display:flex; align-items:center; gap:8px;">
                    <span data-icon="folderOpen"></span> Tournament Library
                </h2>
                <button id="btn-close-library" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:18px;">X</button>
            </div>

            <!-- Top Actions -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <button id="btn-save-current-to-library" style="background:var(--accent); color:var(--text-on-accent); border:none; padding:8px 14px; border-radius:4px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px;">
                    ${getIcon('save', 14)} Save Current to Library
                </button>

                <div style="display:flex; gap:8px;">
                    <input type="file" id="library-file-import" accept=".json" style="display:none;">
                    <button id="btn-library-import" style="background:var(--warning); color:var(--text-on-accent); border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:6px;">
                        ${getIcon('folder', 14)} Import (Single / Bundle)
                    </button>
                    <button id="btn-export-all-library" ${!hasTournaments ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background:var(--success); color:var(--text-on-accent); border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:6px;">
                        ${getIcon('save', 14)} Export All (${tournaments.length})
                    </button>
                </div>
            </div>

            <!-- Selection Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); padding:8px 12px; border-radius:4px; margin-bottom:10px; border:1px solid var(--border-main);">
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="chk-select-all" ${allSelected ? 'checked' : ''} ${!hasTournaments ? 'disabled' : ''}>
                    <span style="font-size:12px; font-weight:bold;">Select All (${selectedIds.size}/${tournaments.length} selected)</span>
                </label>
                <button id="btn-export-selected" ${selectedIds.size === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="background:var(--success); color:var(--text-on-accent); border:none; padding:4px 10px; border-radius:3px; font-size:11px; font-weight:bold; cursor:pointer;">
                    Export Selected (${selectedIds.size})
                </button>
            </div>

            <!-- Tournament List -->
            <div id="library-list-container" style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:8px; max-height:50vh; padding-right:4px;">
                ${!hasTournaments ? `
                    <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">
                        No tournaments saved in the library yet. Click <strong>"Save Current to Library"</strong> above or import a backup file.
                    </div>
                ` : tournaments.map(t => {
                    const isChecked = selectedIds.has(t.id);
                    const isCurrent = currentTournament && currentTournament.id === t.id;
                    const dateStr = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() + ' ' + new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                    const playerCount = t.players?.length || 0;
                    const stagesCount = t.stages?.length || 0;

                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); border:1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-main)'}; border-left:4px solid ${isCurrent ? 'var(--accent)' : 'var(--border-main)'}; padding:10px; border-radius:4px;">
                            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex-grow:1;">
                                <label class="custom-checkbox-label">
                                    <input type="checkbox" class="chk-tournament-item" data-id="${t.id}" ${isChecked ? 'checked' : ''}>
                                </label>
                                <div style="min-width:0; flex-grow:1;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; color:var(--text-main);">${t.settings?.name || 'Untitled Tournament'}</strong>
                                        ${isCurrent ? `<span style="font-size:10px; background:var(--accent); color:var(--text-on-accent); padding:1px 6px; border-radius:3px; font-weight:bold;">Active</span>` : ''}
                                    </div>
                                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                                        ${playerCount} Players &bull; ${stagesCount} Stages &bull; ${t.status || 'setup'} &bull; <small>${dateStr}</small>
                                    </div>
                                </div>
                            </div>

                            <div style="display:flex; gap:6px; flex-shrink:0; margin-left:10px;">
                                <button class="btn-load-tourney" data-id="${t.id}" style="background:var(--accent); color:var(--text-on-accent); border:none; padding:4px 8px; border-radius:3px; font-size:11px; font-weight:bold; cursor:pointer;">Load</button>
                                <button class="btn-export-single" data-id="${t.id}" style="background:var(--border-main); color:var(--text-main); border:none; padding:4px 8px; border-radius:3px; font-size:11px; cursor:pointer;" title="Export Single JSON">${getIcon('save', 12)}</button>
                                <button class="btn-delete-tourney" data-id="${t.id}" style="background:var(--danger); color:var(--text-on-accent); border:none; padding:4px 8px; border-radius:3px; font-size:11px; font-weight:bold; cursor:pointer;" title="Delete">X</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        document.getElementById('btn-close-library').onclick = () => {
            overlay.remove();
            activeModalOverlay = null;
        };

        // Select all / Deselect all
        const chkAll = document.getElementById('chk-select-all');
        if (chkAll) {
            chkAll.onchange = (e) => {
                if (e.target.checked) tournaments.forEach(t => selectedIds.add(t.id));
                else selectedIds.clear();
                render();
            };
        }

        // item checkbox toggles
        document.querySelectorAll('.chk-tournament-item').forEach(chk => {
            chk.onchange = (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) selectedIds.add(id);
                else selectedIds.delete(id);
                render();
            };
        });

        // Save Current to Library™
        document.getElementById('btn-save-current-to-library').onclick = async () => {
            await saveTournamentToLibrary(currentTournament);
            tournaments = await getLibraryTournaments();
            render();
        };

        // Load tournament
        document.querySelectorAll('.btn-load-tourney').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const target = await getTournamentFromLibrary(id);
                if (target) {
                    await saveTournamentLocally(target);
                    overlay.remove();
                    activeModalOverlay = null;
                    onSwitchTournament(target);
                }
            };
        });

        // Delete tournament
        document.querySelectorAll('.btn-delete-tourney').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (confirm("Delete this tournament from the library?")) {
                    await deleteTournamentFromLibrary(id);
                    selectedIds.delete(id);
                    tournaments = await getLibraryTournaments();
                    render();
                }
            };
        });

        // Export Single
        document.querySelectorAll('.btn-export-single').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const t = await getTournamentFromLibrary(id);
                if (t) exportTournamentJSON(t);
            };
        });

        // Export All
        document.getElementById('btn-export-all-library').onclick = () => {
            if (tournaments.length > 0) {
                exportTournamentBundleJSON(tournaments, "Tournament_Library_All");
            }
        };

        // Export Selected
        document.getElementById('btn-export-selected').onclick = () => {
            const selected = tournaments.filter(t => selectedIds.has(t.id));
            if (selected.length > 0) {
                exportTournamentBundleJSON(selected, `Tournament_Library_Selected_${selected.length}`);
            }
        };

        // Import Button
        const fileIn = document.getElementById('library-file-import');
        document.getElementById('btn-library-import').onclick = () => fileIn.click();

        fileIn.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            parseTournamentImportJSON(file, async (success, result) => {
                if (!success) {
                    alert(result);
                    return;
                }

                if (result.type === 'bundle') {
                    for (const t of result.tournaments) {
                        await saveTournamentToLibrary(t);
                    }
                    alert(`Imported ${result.tournaments.length} tournament(s) into the library.`);
                } else if (result.type === 'single') {
                    await saveTournamentToLibrary(result.tournament);
                    alert(`Imported "${result.tournament.settings?.name || 'Tournament'}" into the library.`);
                }

                tournaments = await getLibraryTournaments();
                render();
            });
            fileIn.value = '';
        };
    }

    render();
}

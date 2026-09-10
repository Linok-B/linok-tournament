import { getLibraryTournaments, getTournamentFromLibrary, saveTournamentToLibrary, deleteTournamentFromLibrary, saveTournamentLocally, updateLibraryOrder } from '../store/localData.js';
import { exportTournamentJSON, exportTournamentBundleJSON, parseTournamentImportJSON } from '../store/export.js';
import { getIcon } from './icons.js';

let activeModalOverlay = null;

let _libMousedown = null;
let _libMousemove = null;
let _libMouseup = null;

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
            cleanupDragListeners();
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
                    ${getIcon('folderOpen', 22)} Tournament Library
                </h2>
                <button id="btn-close-library" style="background:transparent; color:var(--text-muted); border:none; cursor:pointer; font-weight:bold; font-size:18px;">X</button>
            </div>

            <!-- Top Actions -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <button id="btn-save-current-to-library" style="background:var(--accent); color:var(--text-on-accent); border:none; height:32px; padding:0 14px; border-radius:4px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:12px; box-sizing:border-box;">
                    ${getIcon('save', 14)} Save Current to Library
                </button>

                <div style="display:flex; gap:8px;">
                    <input type="file" id="library-file-import" accept=".json" style="display:none;">
                    <button id="btn-library-import" style="background:var(--warning); color:var(--text-on-accent); border:none; height:32px; padding:0 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:6px; box-sizing:border-box;">
                        ${getIcon('folder', 14)} Import (Single / Bundle)
                    </button>
                    <button id="btn-export-all-library" ${!hasTournaments ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background:var(--success); color:var(--text-on-accent); border:none; height:32px; padding:0 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:6px; box-sizing:border-box;">
                        ${getIcon('save', 14)} Export All (${tournaments.length})
                    </button>
                </div>
            </div>

            <!-- Selection Bar -->
            <div id="library-select-bar" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); min-height:42px; padding:6px 12px; border-radius:4px; margin-bottom:10px; border:1px solid var(--border-main); box-sizing:border-box;">
                <label class="custom-checkbox-label">
                    <input type="checkbox" id="chk-select-all" ${allSelected ? 'checked' : ''} ${!hasTournaments ? 'disabled' : ''}>
                    <span style="font-size:12px; font-weight:bold;">Select All (${selectedIds.size}/${tournaments.length} selected)</span>
                </label>
                <button id="btn-export-selected" ${selectedIds.size === 0 ? 'disabled' : ''} style="background:var(--success); color:var(--text-on-accent); border:none; height:28px; padding:0 12px; border-radius:3px; font-size:11px; font-weight:bold; cursor:${selectedIds.size === 0 ? 'not-allowed' : 'pointer'}; opacity:${selectedIds.size === 0 ? '0.4' : '1'}; display:inline-flex; align-items:center; box-sizing:border-box;">
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
                    const tourneyName = t.settings?.name || 'Untitled Tournament';

                    return `
                        <div class="library-tourney-row" data-id="${t.id}" style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.25); border:1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-main)'}; border-left:4px solid ${isCurrent ? 'var(--accent)' : 'var(--border-main)'}; padding:8px 10px; border-radius:4px; gap:8px;">
                            
                            <!-- Drag Handle -->
                            <div class="tourney-drag-handle" style="color:var(--accent); font-size:16px; font-weight:bold; cursor:grab; padding:0 4px; user-select:none; flex-shrink:0;">⋮⋮</div>

                            <label class="custom-checkbox-label" style="flex-shrink:0;">
                                <input type="checkbox" class="chk-tournament-item" data-id="${t.id}" ${isChecked ? 'checked' : ''}>
                            </label>

                            <div style="min-width:0; flex-grow:1;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <strong title="${tourneyName}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px; color:var(--text-main); display:block; max-width:320px;">
                                        ${tourneyName}
                                    </strong>
                                    ${isCurrent ? `<span class="tourney-active-badge" style="font-size:10px; background:var(--accent); color:var(--text-on-accent); padding:1px 6px; border-radius:3px; font-weight:bold; flex-shrink:0;">Active</span>` : ''}
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                                    ${playerCount} Players &bull; ${stagesCount} Stages &bull; ${t.status || 'setup'} &bull; <small>${dateStr}</small>
                                </div>
                            </div>

                            <div style="display:flex; gap:6px; flex-shrink:0;">
                                <button class="btn-load-tourney" data-id="${t.id}" style="background:var(--accent); color:var(--text-on-accent); border:none; padding:4px 8px; border-radius:3px; font-size:11px; font-weight:bold; cursor:pointer;">Load</button>
                                <button class="btn-export-single" data-id="${t.id}" style="background:var(--success); color:var(--text-on-accent); border:none; padding:4px 8px; border-radius:3px; font-size:11px; cursor:pointer; display:inline-flex; align-items:center;" title="Export to File">${getIcon('save', 12)}</button>
                                <button class="btn-delete-tourney" data-id="${t.id}" style="background:var(--danger); color:var(--text-on-accent); border:none; padding:4px 8px; border-radius:3px; font-size:11px; font-weight:bold; cursor:pointer;" title="Delete">X</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        bindEvents();
        applyLibraryDragAndDrop();
    }

    function cleanupDragListeners() {
        const list = document.getElementById('library-list-container');
        if (list && _libMousedown) list.removeEventListener('mousedown', _libMousedown);
        if (_libMousemove) document.removeEventListener('mousemove', _libMousemove);
        if (_libMouseup) document.removeEventListener('mouseup', _libMouseup);
    }

    function applyLibraryDragAndDrop() {
        const container = document.getElementById('library-list-container');
        if (!container) return;

        cleanupDragListeners();

        let draggingElement = null;
        let placeholder = null;
        let offsetY = 0;
        let lastHoverCheck = 0;

        _libMousedown = (e) => {
            if (!e.target.classList.contains('tourney-drag-handle')) return;
            e.preventDefault();

            const row = e.target.closest('.library-tourney-row');
            if (!row) return;

            const rect = row.getBoundingClientRect();
            offsetY = e.clientY - rect.top;

            placeholder = row.cloneNode(true);
            placeholder.style.opacity = '0.3';
            placeholder.style.border = '2px dashed var(--border-main)';
            container.insertBefore(placeholder, row);

            draggingElement = row;
            draggingElement.style.position = 'fixed';
            draggingElement.style.zIndex = '10001';
            draggingElement.style.width = `${rect.width}px`;
            draggingElement.style.top = `${e.clientY - offsetY}px`;
            draggingElement.style.left = `${rect.left}px`;
            draggingElement.style.pointerEvents = 'none';

            document.body.style.cursor = 'grabbing';
        };

        _libMousemove = (e) => {
            if (!draggingElement) return;
            draggingElement.style.top = `${e.clientY - offsetY}px`;

            if (e.timeStamp - lastHoverCheck > 16) {
                lastHoverCheck = e.timeStamp;
                const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
                const hoveredRow = elementsUnderMouse.find(el => el.classList && el.classList.contains('library-tourney-row') && el !== draggingElement && el !== placeholder);

                if (hoveredRow && hoveredRow.parentNode === container) {
                    const hoverRect = hoveredRow.getBoundingClientRect();
                    const hoverMiddleY = hoverRect.top + (hoverRect.height / 2);
                    if (e.clientY < hoverMiddleY) container.insertBefore(placeholder, hoveredRow);
                    else container.insertBefore(placeholder, hoveredRow.nextSibling);
                }
            }
        };

        _libMouseup = async () => {
            if (!draggingElement) return;
            document.body.style.cursor = 'default';

            try {
                if (placeholder && placeholder.parentNode === container) {
                    container.insertBefore(draggingElement, placeholder);
                    placeholder.remove();
                }

                // Reset ONLY drag positioning, do NOT destroy inline row styles (fixed issue where css died and got default (non-)formatting)
                draggingElement.style.position = '';
                draggingElement.style.zIndex = '';
                draggingElement.style.width = '';
                draggingElement.style.top = '';
                draggingElement.style.left = '';
                draggingElement.style.pointerEvents = '';

                const orderedIds = Array.from(container.querySelectorAll('.library-tourney-row')).map(el => el.getAttribute('data-id'));
                tournaments.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));

                await updateLibraryOrder(orderedIds);
            } catch (err) {
                console.error("Library reorder failed:", err);
            } finally {
                draggingElement = null;
                placeholder = null;
            }
        };

        container.addEventListener('mousedown', _libMousedown);
        document.addEventListener('mousemove', _libMousemove);
        document.addEventListener('mouseup', _libMouseup);
    }

    function bindEvents() {
        document.getElementById('btn-close-library').onclick = () => {
            cleanupDragListeners();
            overlay.remove();
            activeModalOverlay = null;
        };

        const chkAll = document.getElementById('chk-select-all');
        if (chkAll) {
            chkAll.onchange = (e) => {
                if (e.target.checked) tournaments.forEach(t => selectedIds.add(t.id));
                else selectedIds.clear();
                render();
            };
        }

        document.querySelectorAll('.chk-tournament-item').forEach(chk => {
            chk.onchange = (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) selectedIds.add(id);
                else selectedIds.delete(id);
                render();
            };
        });

        document.getElementById('btn-save-current-to-library').onclick = async () => {
            await saveTournamentToLibrary(currentTournament);
            tournaments = await getLibraryTournaments();
            render();
        };

        document.querySelectorAll('.btn-load-tourney').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const target = await getTournamentFromLibrary(id);
                if (target) {
                    await saveTournamentLocally(target);
                    cleanupDragListeners();
                    overlay.remove();
                    activeModalOverlay = null;
                    onSwitchTournament(target);
                }
            };
        });

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

        document.querySelectorAll('.btn-export-single').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const t = await getTournamentFromLibrary(id);
                if (t) exportTournamentJSON(t);
            };
        });

        document.getElementById('btn-export-all-library').onclick = () => {
            if (tournaments.length > 0) {
                exportTournamentBundleJSON(tournaments, "Tournament_Library_All");
            }
        };

        document.getElementById('btn-export-selected').onclick = () => {
            const selected = tournaments.filter(t => selectedIds.has(t.id));
            if (selected.length > 0) {
                exportTournamentBundleJSON(selected, `Tournament_Library_Selected_${selected.length}`);
            }
        };

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

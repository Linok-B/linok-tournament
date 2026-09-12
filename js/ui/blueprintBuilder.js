import { getIcon } from './icons.js';
import { openDPWSetupModal } from './dpwSetup.js';
import { openStageSettingsModal } from './stageSettings.js';
import { getPendingTiebreakers } from './tiebreakerModal.js';
import { saveTournamentLocally } from '../store/localData.js';

let _stageMousedown = null;
let _stageMousemove = null;
let _stageMouseup = null;

const formatNames = {
    "single_elimination": "Single Elim",
    "round_robin": "Round Robin",
    "swiss": "Swiss", 
    "dpw_swiss": "DPW Swiss",
    "double_elimination": "Double Elim" 
};

export function renderBlueprintList(currentTournament, onUpdate) {
    const list = document.getElementById('blueprint-list');
    if (!list) return;
    list.innerHTML = '';

    currentTournament.settings.pipeline.forEach((stage, index) => {
        const isStarted = index < currentTournament.stages.length;
        
        let details = [];
        if (stage.maxRounds) details.push(`${stage.maxRounds} Rnds`);
        if (stage.cutToTop) details.push(`Top ${stage.cutToTop}`);
        const detailStr = details.length > 0 ? ` <small style="color:gray;">(${details.join(', ')})</small>` : '';
        
        list.innerHTML += `
            <div class="blueprint-stage-card" data-index="${index}" data-locked="${isStarted}" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px; border-left: 3px solid ${isStarted ? 'var(--success)' : 'var(--accent)'}; box-sizing: border-box; width: 100%;">
                
                <!-- 1. Drag Handle (Only shows if stage is UNSTARTED) -->
                ${!isStarted ? `<div class="stage-drag-handle" style="color: var(--accent); font-size: 16px; font-weight: bold; cursor: grab; padding: 5px; flex-shrink: 0; user-select:none;">⋮⋮</div>` : ''}
                
                <span style="font-size: 13px; flex-grow:1; margin-left:${isStarted ? '24px' : '0'};"><b>${index + 1}.</b> ${formatNames[stage.type]}${detailStr}</span>
                
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${stage.type === 'dpw_swiss' && !isStarted ? `<button class="btn-edit-dpw" data-index="${index}" style="background: transparent; color: var(--warning); border: none; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Edit Teams">${getIcon('gear', 14)}</button>` : ''}
                    <button class="btn-edit-stage-settings" data-index="${index}" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; display: flex; align-items: center; padding: 0;" title="Stage Settings">${getIcon('gear', 14)}</button>
                    ${!isStarted ? `<button class="btn-remove-stage" data-index="${index}" style="background: transparent; color: var(--danger); border: none; cursor: pointer; font-weight: bold; padding: 0;">X</button>` : ''}
                </div>
            </div>
        `;
    });

    applyStageDragAndDrop(currentTournament, onUpdate);
}

// Stage Reordering Drag 'n' Drop
function applyStageDragAndDrop(currentTournament, onUpdate) {
    const container = document.getElementById('blueprint-list');
    if (!container) return;

    let draggingElement = null;
    let placeholder = null;
    let offsetY = 0;

    // Clean up old listeners
    if (_stageMousedown) container.removeEventListener('mousedown', _stageMousedown);
    if (_stageMousemove) document.removeEventListener('mousemove', _stageMousemove);
    if (_stageMouseup) document.removeEventListener('mouseup', _stageMouseup);

    _stageMousedown = (e) => {
        if (e.button !== 0) return;
        if (draggingElement) return;
        if (!e.target.classList.contains('stage-drag-handle')) return;
        e.preventDefault();
        
        const card = e.target.closest('.blueprint-stage-card');
        if (!card || card.getAttribute('data-locked') === 'true') return;

        const rect = card.getBoundingClientRect();
        offsetY = e.clientY - rect.top;

        placeholder = card.cloneNode(true);
        placeholder.className = 'blueprint-stage-card drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.width = `${rect.width}px`;
        container.insertBefore(placeholder, card);

        draggingElement = card;
        draggingElement.classList.add('drag-active-element');
        draggingElement.style.width = `${rect.width}px`;
        draggingElement.style.height = `${rect.height}px`;
        draggingElement.style.top = `${e.clientY - offsetY}px`;
        draggingElement.style.left = `${rect.left}px`;

        document.body.style.cursor = 'grabbing';
    };

    _stageMousemove = (e) => {
        if (!draggingElement) return;
        draggingElement.style.top = `${e.clientY - offsetY}px`;

        // checks vertical bounds against unlocked stage cards
        const unlockedCards = Array.from(container.querySelectorAll('.blueprint-stage-card[data-locked="false"]'))
            .filter(el => el !== draggingElement && el !== placeholder);

        const hoveredCard = unlockedCards.find(card => {
            const rect = card.getBoundingClientRect();
            return e.clientY >= rect.top && e.clientY <= rect.bottom;
        });

        if (hoveredCard) {
            const hoverRect = hoveredCard.getBoundingClientRect();
            const hoverMiddleY = hoverRect.top + (hoverRect.height / 2);
            if (e.clientY < hoverMiddleY) container.insertBefore(placeholder, hoveredCard);
            else container.insertBefore(placeholder, hoveredCard.nextSibling);
        }
    };

    _stageMouseup = async () => {
        if (!draggingElement) return;
        document.body.style.cursor = 'default';

        const el = draggingElement;
        const ph = placeholder;

        draggingElement = null;
        placeholder = null;

        // snapshot prior pipeline in case storage write fails
        const previousPipeline = [...currentTournament.settings.pipeline];

        try {
            if (ph && ph.parentNode === container) {
                container.insertBefore(el, ph);
                ph.remove();
            }

            el.classList.remove('drag-active-element');
            el.style.position = '';
            el.style.zIndex = '';
            el.style.width = '';
            el.style.height = '';
            el.style.top = '';
            el.style.left = '';
            el.style.pointerEvents = '';

            const lockedCount = currentTournament.stages.length;
            const lockedPipeline = currentTournament.settings.pipeline.slice(0, lockedCount);
            
            const unlockedDOMs = Array.from(container.querySelectorAll('.blueprint-stage-card[data-locked="false"]'));
            const unlockedIndices = unlockedDOMs.map(card => parseInt(card.getAttribute('data-index')));
            
            const reorderedUnlocked = unlockedIndices.map(oldIdx => currentTournament.settings.pipeline[oldIdx]);
            currentTournament.settings.pipeline = [...lockedPipeline, ...reorderedUnlocked];

            // Hopemaxxing UI update
            if (typeof onUpdate === 'function') onUpdate();

            // storage write w/ retry & rollback reconciliation
            try {
                await saveTournamentLocally(currentTournament);
            } catch (saveErr) {
                console.warn("Storage write failed. Retrying once...", saveErr);
                try {
                    await saveTournamentLocally(currentTournament);
                } catch (retryErr) {
                    console.error("Critical storage error: could not save reordered stages.", retryErr);
                    // Rollback state and UI so screen matches true storage
                    currentTournament.settings.pipeline = previousPipeline;
                    if (typeof onUpdate === 'function') onUpdate();
                    alert("Storage Error: Failed to save the new stage order to storage.");
                }
            }
        } catch (err) {
            console.error("Stage reorder error:", err);
            currentTournament.settings.pipeline = previousPipeline;
            if (typeof onUpdate === 'function') onUpdate();
        }
    };

    container.addEventListener('mousedown', _stageMousedown);
    document.addEventListener('mousemove', _stageMousemove);
    document.addEventListener('mouseup', _stageMouseup);
}

export function initBlueprintBuilder(getTournament, onUpdate) {
    // Add a new stage to the pipeline
    document.getElementById('btn-add-stage').addEventListener('click', async () => {
        const currentTournament = getTournament();
        const type = document.getElementById('blueprint-type').value;
        const rounds = parseInt(document.getElementById('blueprint-rounds').value);
        const cut = parseInt(document.getElementById('blueprint-cut').value);
        
        // DPW SWISS INTERCEPT
        if (type === "dpw_swiss") {
            if (currentTournament.players.length < 2) {
                alert("Add some players first before setting up DPW Swiss!");
                return;
            }
            
            openDPWSetupModal(currentTournament.players, rounds, cut, async (dpwConfig, playerTSMap) => {
                currentTournament.players.forEach(p => {
                    if (!p.metadata) p.metadata = {};
                    p.metadata.dpwTS = playerTSMap[p.id] || 0;
                });
                currentTournament.settings.pipeline.push(dpwConfig);
                document.getElementById('blueprint-rounds').value = '';
                document.getElementById('blueprint-cut').value = '';
                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            }, { tiebreakers: getPendingTiebreakers() });
            
            return;
        }

        // Standard Formats
        const newStage = { type: type, tiebreakers: getPendingTiebreakers() };
        
        if (!isNaN(rounds) && rounds > 0) newStage.maxRounds = rounds;
        if (!isNaN(cut) && cut > 0) newStage.cutToTop = cut;
        
        currentTournament.settings.pipeline.push(newStage);
        document.getElementById('blueprint-rounds').value = '';
        document.getElementById('blueprint-cut').value = '';
        
        await saveTournamentLocally(currentTournament);
        if (typeof onUpdate === 'function') onUpdate();
    });

    // Unified Blueprint Button Handler (Removes and Edits Stages)
    document.getElementById('setup-blueprint-group').addEventListener('click', async (e) => {
        const currentTournament = getTournament();

        // Handle "X" (Remove)
        if (e.target && e.target.classList.contains('btn-remove-stage')) {
            const indexToRemove = parseInt(e.target.getAttribute('data-index'));
            currentTournament.settings.pipeline.splice(indexToRemove, 1);
            await saveTournamentLocally(currentTournament);
            if (typeof onUpdate === 'function') onUpdate();
        }
        
        // Handle Edit DPW
        if (e.target && e.target.classList.contains('btn-edit-dpw')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const stageConfig = currentTournament.settings.pipeline[index];
            
            openDPWSetupModal(currentTournament.players, stageConfig.maxRounds, stageConfig.cutToTop, async (newConfig, newPlayerTSMap) => {
                currentTournament.settings.pipeline[index] = newConfig;
                currentTournament.players.forEach(p => {
                    if (!p.metadata) p.metadata = {};
                    p.metadata.dpwTS = newPlayerTSMap[p.id] || 0;
                });
                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            }, stageConfig);
        }

        // Handle General Stage Settings
        if (e.target && e.target.closest('.btn-edit-stage-settings')) {
            const index = parseInt(e.target.closest('.btn-edit-stage-settings').getAttribute('data-index'));
            
            openStageSettingsModal(index, currentTournament, async () => {
                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            });
        }
    });
}

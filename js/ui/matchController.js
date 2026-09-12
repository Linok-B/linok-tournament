import { getIcon } from './icons.js';
import { validateDPWStageReadiness } from './dpwSetup.js';
import { saveTournamentLocally } from '../store/localData.js';
import { exportTournamentJSON } from '../store/export.js';

export function initMatchController(getTournament, onUpdate) {
    const container = document.getElementById('player-list-container');
    if (!container) return;

    // Master click delegator for the tournament display panel
    container.addEventListener('click', async (e) => {
        const currentTournament = getTournament();

        // 1. Handle "Submit Score" Button
        if (e.target && e.target.classList.contains('btn-report')) {
            const matchId = e.target.getAttribute('data-matchid');

            // STAGE TRANSITION GUARD (DPW Validation)
            const activeStage = currentTournament.stages[currentTournament.stages.length - 1];
            if (activeStage) {
                const currentRound = activeStage.data.rounds[activeStage.data.rounds.length - 1];
                const unfinishedMatches = currentRound.filter(m => m.winner === null && !m.isBye);
                
                // If this is the last unfinished match, submitting it MIGHT end the stage.
                if (unfinishedMatches.length === 1 && unfinishedMatches[0].id === matchId) {
                    const nextConfig = currentTournament.settings.pipeline[currentTournament.stages.length];
                    if (!validateDPWStageReadiness(nextConfig, currentTournament.players, 'report')) return;
                }
            }
            
            // Safely grab the inputs. If they don't exist in the DOM, default to '0'
            const s1Input = document.getElementById(`s1-${matchId}`);
            const s2Input = document.getElementById(`s2-${matchId}`);
            const dInput = document.getElementById(`d-${matchId}`);

            const score1 = s1Input ? s1Input.value : 0;
            const score2 = s2Input ? s2Input.value : 0;
            const draws = dInput ? dInput.value : 0;

            // Send to Engine
            const success = await currentTournament.reportMatchScore(matchId, score1, score2, draws);
            
            if (success) {
                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            } else {
                alert("Error reporting score.");
            }
        }

        // 2. Handle "Remove Player (X)" Button
        if (e.target && e.target.classList.contains('btn-remove-player')) {
            const playerId = e.target.getAttribute('data-id');
            
            if (currentTournament.removePlayer(playerId)) {
                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            }
        }

        // 3. Handle Stage Tab Clicks
        if (e.target && e.target.classList.contains('btn-stage-tab')) {
            const tabIndex = parseInt(e.target.getAttribute('data-index'));
            window.viewingStageIndex = tabIndex; // Set the global viewing index

            // Reset the camera position when switching tabs
            window.bracketCamera = { x: 0, y: 0, scale: 1 };
            
            if (typeof onUpdate === 'function') onUpdate(); // Redraw the screen
        }

        // 4. Handle Edit Match Button (Custom Modal)
        if (e.target && e.target.classList.contains('btn-edit-match')) {
            const matchId = e.target.getAttribute('data-matchid');
            let result = currentTournament.undoMatch(matchId, false);

            if (result.requiresConfirmation) {
                const modal = document.getElementById('warning-modal');
                
                // Dynamically set text back to the Edit Warning
                document.getElementById('warning-modal-title').innerHTML = `${getIcon('warning', 28)} DESTRUCTIVE ACTION`;
                document.getElementById('warning-modal-text').innerText = "Editing this match will permanently delete all rounds and stages that happened after it.";
                document.getElementById('modal-btn-confirm').innerText = "Delete & Edit";
                
                modal.style.display = 'flex';

                // Define exactly what the buttons do inside the modal
                document.getElementById('modal-btn-cancel').onclick = () => {
                    modal.style.display = 'none'; // Close modal, do nothing
                };

                document.getElementById('modal-btn-export').onclick = () => {
                    exportTournamentJSON(currentTournament); // Downloads backup
                };

                document.getElementById('modal-btn-confirm').onclick = async () => {
                    // User agreed, force destructive undo
                    const finalResult = currentTournament.undoMatch(matchId, true);
                    if (finalResult.success) {
                        await saveTournamentLocally(currentTournament);
                        window.viewingStageIndex = currentTournament.stages.length - 1; 
                        if (typeof onUpdate === 'function') onUpdate();
                    }
                    modal.style.display = 'none'; // Close modal
                };

            } else if (result.success) {
                // It was a safe undo (latest round), no warning needed
                await saveTournamentLocally(currentTournament);
                window.viewingStageIndex = currentTournament.stages.length - 1; 
                if (typeof onUpdate === 'function') onUpdate();
            }
        }

        // 5. Force End Stage Early (W/ Options)
        if (e.target && e.target.id === 'btn-force-end-stage') {
            const activeStage = currentTournament.stages[currentTournament.stages.length - 1];
            if (!activeStage || !activeStage.data.rounds || activeStage.data.rounds.length === 0) return;

            // STAGE TRANSITION GUARD (DPW Validation)
            const nextConfig = currentTournament.settings.pipeline[currentTournament.stages.length];
            if (!validateDPWStageReadiness(nextConfig, currentTournament.players, 'force_end')) return;

            const currentRoundIndex = activeStage.data.rounds.length - 1;
            const currentRound = activeStage.data.rounds[currentRoundIndex];
            
            // Are there actually unfinished matches?
            const isRoundUnfinished = currentRound.some(m => m.winner === null && !m.isBye);
            const matchesSubmitted = currentRound.filter(m => m.winner !== null || m.isBye).length;
            
            // Helper function to finalize and cleanly advance view
            async function executeEndStage() {
                currentTournament.recalculateAllStats(); 
                activeStage.status = "completed";
                activeStage.data.isComplete = true; 
                
                if (currentTournament.stages.length >= currentTournament.settings.pipeline.length) {
                    currentTournament.status = "completed";
                } else {
                    currentTournament.transitionToNextStage(currentTournament.players);
                }

                // Always snap the camera and viewing tab to the newly active stage
                window.viewingStageIndex = currentTournament.stages.length - 1;
                window.bracketCamera = { x: 0, y: 0, scale: 1 };

                await saveTournamentLocally(currentTournament);
                if (typeof onUpdate === 'function') onUpdate();
            }

            // If the round is already 100% complete, end immediately
            if (!isRoundUnfinished) {
                await executeEndStage(); 
                return;
            }

            // If not a single real match has been scored yet
            if (matchesSubmitted === 0) {
                if (activeStage.data.rounds.length <= 1) {
                    alert("Cannot end stage on Round 1 with zero matches played. To cancel this tournament, click 'Restart Tournament' instead.");
                    return;
                }
                activeStage.data.rounds.pop(); // Silent rollback of empty subsequent round
                await executeEndStage();
                return;
            }

            // Round is partial. Show the Modal
            const modal = document.getElementById('end-stage-modal');
            modal.style.display = 'flex';

            document.getElementById('modal-btn-end-rollback').onclick = async () => {
                // Cannot rollback Round 1 (no previous rounds exist to determine standings)
                if (activeStage.data.rounds.length <= 1) {
                    alert("Cannot rollback Round 1 because there are no previous rounds to determine standings. Choose 'Force Ties' or click 'Restart Tournament' in the sidebar.");
                    return;
                }
                modal.style.display = 'none';
                activeStage.data.rounds.pop(); 
                await executeEndStage();
            };

            document.getElementById('modal-btn-end-tie').onclick = async () => {
                if (activeStage.config.type === "single_elimination" || activeStage.config.type === "double_elimination") {
                    alert("You cannot force ties in an Elimination bracket. Please Rollback instead.");
                    return;
                }
                modal.style.display = 'none';
                currentRound.forEach(m => {
                    if (m.winner === null && !m.isBye) {
                        m.score1 = 0; m.score2 = 0; m.draws = 0; m.winner = "tie";
                    }
                });
                await executeEndStage();
            };

            document.getElementById('modal-btn-end-cancel').onclick = () => {
                modal.style.display = 'none';
            };
        }
    });

    // Handle Custom Drag-and-Drop List Reordering
    document.addEventListener('playerListReordered', async (e) => {
        const currentTournament = getTournament();
        if (currentTournament.status !== "setup") return;

        const newOrderIds = e.detail.newOrderIds;
        
        // 1. Update the Engine
        const reorderedPlayers = newOrderIds.map(id => {
            return currentTournament.players.find(p => p.id === id);
        }).filter(Boolean); 
        currentTournament.players = reorderedPlayers;
        
        currentTournament.players.forEach((p, index) => {
            p.seed = index + 1;
            p.originalSeed = index + 1;
        });
        
        // 2. Target the correct sub-list
        const listContainer = document.getElementById('players-list');
        if (listContainer) {
            Array.from(listContainer.children).forEach((card, index) => {
                const seedSpan = card.querySelector('.seed-number');
                if (seedSpan) {
                    seedSpan.innerText = `${index + 1}`;
                }
            });
        }
        
        await saveTournamentLocally(currentTournament);
    });
}

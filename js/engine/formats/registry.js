import * as SingleElimination from './elimination.js';
import * as RoundRobin from './roundRobin.js';
import * as Swiss from './swiss.js';
import * as DoubleElimination from './doubleElimination.js'; 

export const Formats = {
    "single_elimination": SingleElimination,
    "round_robin": RoundRobin,
    "swiss": Swiss,
    "double_elimination": DoubleElimination
};

export function getFormat(type) {
    const format = Formats[type];
    if (!format) throw new Error(`Format ${type} not found in registry!`);
    return format;
}

// In js/engine/formats/registry.js - Replace simulatePreview

export function simulatePreview(stageData, config) {
    let simData = JSON.parse(JSON.stringify(stageData));
    const formatEngine = Formats[config.type];
    let safeguard = 0; 
    
    // Track the actual current round length so we don't accidentally simulate the present!
    const realRoundsCount = stageData.rounds.length;

    while (!simData.isComplete && safeguard < 20) {
        safeguard++;
        const currentRound = simData.rounds[simData.rounds.length - 1];

        // 1. Mark future rounds as simulated
        if (simData.rounds.length > realRoundsCount) {
            currentRound.forEach(m => m.isSimulated = true);
        }

        // 2. Artificially finish the round
        currentRound.forEach(m => {
            // CRITICAL FIX: Only force a winner if we are IN THE FUTURE!
            // Leave current active matches alone so their HTML draws correctly!
            if (!m.winner && simData.rounds.length > realRoundsCount) {
                if (m.player1 === null && m.player2 === null) {
                    m.winner = { id: "phantom", isPhantom: true };
                } else {
                    if (!m.player1) m.player1 = { id: `ghost-p1-${m.id}`, name: "TBD", isGhost: true };
                    if (!m.player2) m.player2 = { id: `ghost-p2-${m.id}`, name: "TBD", isGhost: true };
                    
                    // NEW: Force the Reset match to appear by making Player 2 win GF1!
                    if (m.bracket === "grand_finals" && !m.bracketReset) {
                        m.winner = m.player2;
                    } else {
                        m.winner = m.player1;
                    }
                }
            }
        });

        // 3. Advance to the next round using REAL math
        // But we ONLY advance if the current round is actually complete (or simulated complete)
        const isRoundReady = currentRound.every(m => m.winner !== null);
        if (isRoundReady) {
            simData = formatEngine.advanceStage(simData, config, []);
        } else {
            break; // If the current active round isn't done, the simulator can't guess the future yet!
        }
    }

    return simData.rounds;
}

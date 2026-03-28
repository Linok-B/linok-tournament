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

export function simulatePreview(stageData, config) {
    // Deep clone the data so we don't accidentally save the simulation to the real tournament!
    let simData = JSON.parse(JSON.stringify(stageData));
    const formatEngine = Formats[config.type];

    // Safety limit to prevent infinite loops
    let safeguard = 0; 
    
    while (!simData.isComplete && safeguard < 20) {
        safeguard++;
        const currentRound = simData.rounds[simData.rounds.length - 1];

        // 1. Mark any newly generated future rounds as "simulated" so the UI knows to draw them as ghosts!
        if (simData.rounds.length > stageData.rounds.length) {
            currentRound.forEach(m => m.isSimulated = true);
        }

        // 2. Artificially finish the round
        currentRound.forEach(m => {
            if (!m.winner) {
                // If it's a pure Phantom match, let it complete as a Phantom
                if (m.player1 === null && m.player2 === null) {
                    m.winner = { id: "phantom", isPhantom: true };
                } else {
                    // Otherwise, fill empty slots with TBD Ghosts and force Player 1 to win
                    if (!m.player1) m.player1 = { id: `ghost-p1-${m.id}`, name: "TBD", isGhost: true };
                    if (!m.player2) m.player2 = { id: `ghost-p2-${m.id}`, name: "TBD", isGhost: true };
                    m.winner = m.player1;
                }
            }
        });

        // 3. Advance to the next round using the REAL tournament math!
        simData = formatEngine.advanceStage(simData, config, []);
    }

    return simData.rounds;
}

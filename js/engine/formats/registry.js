import * as SingleElimination from './elimination.js';
import * as RoundRobin from './roundRobin.js';
import * as Swiss from './swiss.js';
import * as DoubleElimination from './doubleElimination.js';
import * as DPWSwiss from './dpwSwiss.js';

export const Formats = {
    "single_elimination": SingleElimination,
    "round_robin": RoundRobin,
    "swiss": Swiss,
    "dpw_swiss": DPWSwiss,
    "double_elimination": DoubleElimination
};

export function getFormat(type) {
    const format = Formats[type];
    if (!format) throw new Error(`Format ${type} not found in registry!`);
    return format;
}


export function simulatePreview(stageData, config) {
    let simData = JSON.parse(JSON.stringify(stageData));
    const formatEngine = Formats[config.type];
    let safeguard = 0; 
    
    const realRoundsCount = stageData.rounds.length;

    while (!simData.isComplete && safeguard < 20) {
        safeguard++;
        const currentRound = simData.rounds[simData.rounds.length - 1];

        // Only tag as a ghost if this round is literally in the future
        const isFutureRound = simData.rounds.length > realRoundsCount;

        currentRound.forEach(m => {
            if (isFutureRound) m.isGhost = true; 

            if (!m.winner) {
                if (m.player1 === null && m.player2 === null) {
                    m.winner = { id: "phantom", isPhantom: true };
                } else {
                    if (!m.player1) m.player1 = { id: `ghost-p1-${m.id}`, name: "TBD", isGhost: true };
                    if (!m.player2) m.player2 = { id: `ghost-p2-${m.id}`, name: "TBD", isGhost: true };
                    
                    // Force Player 2 to win GF1 so the Reset Match always previews
                    if (m.bracket === "grand_finals" && !m.bracketReset) m.winner = m.player2; 
                    else m.winner = m.player1;
                }
            }
        });

        // Always advance. The simulated round is fully populated
        simData = formatEngine.advanceStage(simData, config, []);
    }

    return simData.rounds;
}

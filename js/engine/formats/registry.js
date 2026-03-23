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

export function getSkeleton(type, playerCount) {
    const format = Formats[type];
    if (format && format.generateSkeleton) {
        return format.generateSkeleton(playerCount);
    }
    return null; // Formats without a skeleton generator just return null
}

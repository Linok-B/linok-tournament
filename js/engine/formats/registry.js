import * as SingleElimination from './elimination.js';
import * as RoundRobin from './roundRobin.js';
import * as Swiss from './swiss.js'; // NEW

export const Formats = {
    "single_elimination": SingleElimination,
    "round_robin": RoundRobin,
    "swiss": Swiss // NEW
};

export function getFormat(type) {
    const format = Formats[type];
    if (!format) throw new Error(`Format ${type} not found in registry!`);
    return format;
}

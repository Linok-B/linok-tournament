// Standard ELO Calculation Formula
export function calculateElo(ratingA, ratingB, scoreA, kFactor = 32) {
    // Expected scores
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    // New Ratings
    const newRatingA = Math.round(ratingA + kFactor * (scoreA - expectedA));
    
    // scoreB is the opposite of scoreA (if A wins (1), B loses (0))
    const scoreB = 1 - scoreA; 
    const newRatingB = Math.round(ratingB + kFactor * (scoreB - expectedB));

    return { newRatingA, newRatingB };
}

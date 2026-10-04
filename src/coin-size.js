// The coin cameras use 100 design pixels per world unit. Match the first
// hero coin's previous diameter, enlarge it 20%, then share that size everywhere.
export const WORLD_UNIT_PX = 100;
export const COIN_SCALE = 2.08 * 1.13 * 1.2;
export const COIN_RADIUS = COIN_SCALE * 1.065;
export const COIN_BOUNDS_RADIUS = Math.hypot(COIN_RADIUS, COIN_SCALE * 0.145);
export const COIN_DIAMETER_PX = COIN_RADIUS * 2 * WORLD_UNIT_PX;

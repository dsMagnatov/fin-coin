const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (value) => value * value * (3 - 2 * value);
const lerp = (from, to, amount) => from + (to - from) * amount;

function pointIsValid(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function assertAnchor(anchor, name) {
  if (!pointIsValid(anchor) || !Number.isFinite(anchor.diameter) || anchor.diameter <= 0) {
    throw new TypeError(`${name} must have finite x, y and a positive diameter`);
  }
}

/** Return the index of the closest visible coin. Ties retain the earlier coin. */
export function closestToCenter(coins, center) {
  if (!pointIsValid(center)) return -1;
  let nearest = -1;
  let distance = Infinity;
  for (let index = 0; index < coins.length; index++) {
    const coin = coins[index];
    if (!pointIsValid(coin) || coin.visible === false) continue;
    const candidate = (coin.x - center.x) ** 2 + (coin.y - center.y) ** 2;
    if (candidate < distance) {
      nearest = index;
      distance = candidate;
    }
  }
  return nearest;
}

/**
 * Evaluate the same coin's route from the scroll position alone.
 *
 * Coordinates and diameters are actual CSS pixels. source is a viewport-space
 * hero pose at scroll 0. story, budget and newsletter are document-space
 * anchors; story.y is measured at the beginning of its sticky interval.
 *
 * Optional budgetDock/newsletterDeparture override the default scroll timing.
 * turn is cumulative radians: each journey leg contributes one complete turn.
 */
export function evaluateTravel(scroll, geometry, source) {
  if (!Number.isFinite(scroll)) throw new TypeError('scroll must be finite');
  assertAnchor(source, 'source');
  for (const name of ['story', 'budget', 'newsletter']) assertAnchor(geometry[name], name);
  const { viewportHeight, heroEnd, storyExit, budgetTop, newsletterTop } = geometry;
  for (const value of [viewportHeight, heroEnd, storyExit, budgetTop, newsletterTop]) {
    if (!Number.isFinite(value)) throw new TypeError('Route timing must be finite');
  }
  if (viewportHeight <= 0 || heroEnd <= 0 || storyExit < heroEnd || budgetTop < storyExit || newsletterTop < budgetTop) {
    throw new RangeError('Route sections must follow their scroll order');
  }
  const budgetDock = geometry.budgetDock ?? budgetTop - viewportHeight * 0.15;
  const newsletterDeparture = geometry.newsletterDeparture ?? newsletterTop - viewportHeight * 0.85;
  if (!Number.isFinite(budgetDock) || !Number.isFinite(newsletterDeparture) || budgetDock <= storyExit || newsletterDeparture < budgetDock || newsletterDeparture >= newsletterTop) {
    throw new RangeError('Route transitions must follow their scroll order');
  }
  const position = Math.max(0, scroll);
  const pinnedStory = { ...geometry.story, y: geometry.story.y - heroEnd };
  const budget = { ...geometry.budget, y: geometry.budget.y - position };
  const newsletter = { ...geometry.newsletter, y: geometry.newsletter.y - position };
  const docked = (anchor, phase, progress, turn) => ({ phase, progress, x: anchor.x, y: anchor.y, diameter: anchor.diameter, turn });
  const flight = (from, to, start, end, phase, turns) => {
    const progress = clamp((position - start) / (end - start), 0, 1);
    const amount = smooth(progress);
    return {
      phase,
      progress,
      x: lerp(from.x, to.x, amount),
      y: lerp(from.y, to.y, amount),
      diameter: lerp(from.diameter, to.diameter, amount),
      turn: (turns + amount) * TAU,
    };
  };

  if (position === 0) return docked(source, 'hero', 0, 0);
  if (position < heroEnd) return flight(source, pinnedStory, 0, heroEnd, 'hero-to-story', 0);
  if (position <= storyExit) {
    const progress = storyExit === heroEnd ? 1 : (position - heroEnd) / (storyExit - heroEnd);
    return docked(pinnedStory, 'story', progress, TAU);
  }
  if (position < budgetDock) return flight(pinnedStory, budget, storyExit, budgetDock, 'story-to-budget', 1);
  if (position <= newsletterDeparture) return docked(budget, 'budget', 1, TAU * 2);
  if (position < newsletterTop) return flight(budget, newsletter, newsletterDeparture, newsletterTop, 'budget-to-newsletter', 2);
  return docked(newsletter, 'newsletter', 1, TAU * 3);
}

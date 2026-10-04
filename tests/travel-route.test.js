import test from 'node:test';
import assert from 'node:assert/strict';
import { closestToCenter, evaluateTravel } from '../src/travel-route.js';

const TAU = Math.PI * 2;
const source = { x: 640, y: 240, diameter: 280 };
const geometry = {
  viewportHeight: 800,
  heroEnd: 800,
  storyExit: 2400,
  budgetTop: 3200,
  newsletterTop: 4000,
  story: { x: 410, y: 1230, diameter: 84 },
  budget: { x: 640, y: 3600, diameter: 280 },
  newsletter: { x: 1020, y: 4606, diameter: 185 },
};
const route = (scroll, settings = geometry, origin = source) => evaluateTravel(scroll, settings, origin);
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('the selected hero coin docks exactly into each slot after one turn per leg', () => {
  const hero = route(0);
  assert.equal(hero.phase, 'hero');
  assert.deepEqual([hero.x, hero.y, hero.diameter, hero.turn], [640, 240, 280, 0]);
  const story = route(800);
  assert.equal(story.phase, 'story');
  assert.deepEqual([story.x, story.y, story.diameter, story.turn], [410, 430, 84, TAU]);
  const budget = route(3080);
  assert.equal(budget.phase, 'budget');
  assert.deepEqual([budget.x, budget.y, budget.diameter, budget.turn], [640, 520, 280, TAU * 2]);
  const newsletter = route(4000);
  assert.equal(newsletter.phase, 'newsletter');
  assert.deepEqual([newsletter.x, newsletter.y, newsletter.diameter, newsletter.turn], [1020, 606, 185, TAU * 3]);
});

test('the story anchor remains still during the complete sticky interval', () => {
  for (const scroll of [800, 1000, 1800, 2400]) {
    const result = route(scroll);
    assert.deepEqual([result.x, result.y, result.diameter, result.turn], [410, 430, 84, TAU]);
  }
  assert.equal(route(800).progress, 0);
  assert.equal(route(2400).progress, 1);
});

test('the route has no jumps at docking, departure or sticky boundaries', () => {
  for (const boundary of [0, 800, 2400, 3080, 3320, 4000]) {
    const before = route(boundary - 1e-6);
    const at = route(boundary);
    const after = route(boundary + 1e-6);
    for (const property of ['x', 'y', 'diameter', 'turn']) {
      near(before[property], at[property], 3e-6);
      near(after[property], at[property], 3e-6);
    }
  }
});

test('reversing the scroll reproduces every pose without remembering prior phases', () => {
  const positions = [0, 190, 540, 800, 2100, 2400, 2750, 3080, 3210, 3320, 3700, 4000, 4200];
  const ascending = positions.map((scroll) => route(scroll));
  const descending = [...positions].reverse().map((scroll) => route(scroll)).reverse();
  assert.deepEqual(descending, ascending);
});

test('ordinary section scrolling keeps the docked coin attached to document space', () => {
  near(route(3250).y - route(3150).y, -100);
  near(route(4150).y - route(4050).y, -100);
  assert.equal(route(4150).turn, TAU * 3);
});

test('resizing all CSS geometry preserves the route proportions and rotations', () => {
  const scale = 0.6;
  const scaled = Object.fromEntries(Object.entries(geometry).map(([name, value]) => [name, typeof value === 'number'
    ? value * scale
    : Object.fromEntries(Object.entries(value).map(([key, coordinate]) => [key, coordinate * scale]))]));
  const scaledSource = Object.fromEntries(Object.entries(source).map(([name, value]) => [name, value * scale]));
  for (const scroll of [100, 800, 1900, 2600, 3200, 3700, 4000]) {
    const original = route(scroll);
    const resized = route(scroll * scale, scaled, scaledSource);
    assert.equal(resized.phase, original.phase);
    for (const name of ['x', 'y', 'diameter']) near(resized[name], original[name] * scale);
    near(resized.turn, original.turn);
    near(resized.progress, original.progress);
  }
});

test('the tall mobile budget docks, departs visibly, and reverses without jumps', () => {
  const mobile = {
    viewportHeight: 844,
    heroEnd: 844,
    storyExit: 2025.6,
    budgetTop: 2869.6,
    newsletterTop: 4169.6,
    story: { x: 185, y: 1224, diameter: 34 },
    budget: { x: 195, y: 3600, diameter: 296.4 },
    newsletter: { x: 314, y: 4815.6, diameter: 103.6 },
  };
  const origin = { x: 195, y: 266, diameter: 280.8 };
  // Match the measured mobile timing: center the budget dock, then start the
  // final flight before that dock has scrolled out of a 390 × 844 viewport.
  mobile.budgetDock = Math.max(mobile.storyExit + 1, mobile.budget.y - mobile.viewportHeight * 0.5);
  mobile.newsletterDeparture = Math.min(mobile.newsletterTop - 1, Math.max(
    mobile.budgetDock + mobile.viewportHeight * 0.3,
    Math.min(mobile.newsletterTop - mobile.viewportHeight * 0.85, mobile.budget.y - mobile.viewportHeight * 0.2),
  ));
  const mobileRoute = scroll => route(scroll, mobile, origin);
  assert.ok(mobile.newsletterTop - mobile.budgetTop > mobile.viewportHeight);
  for (const scroll of [mobile.budgetDock, mobile.budgetDock + 100, mobile.newsletterDeparture]) {
    const result = mobileRoute(scroll);
    assert.equal(result.phase, 'budget');
    near(result.x, mobile.budget.x);
    near(result.y + scroll, mobile.budget.y);
    near(result.diameter, mobile.budget.diameter);
  }
  near(mobileRoute(mobile.budgetDock).y, mobile.viewportHeight / 2);
  const arrival = mobileRoute(mobile.newsletterTop);
  assert.equal(arrival.phase, 'newsletter');
  near(arrival.x, mobile.newsletter.x);
  near(arrival.y + mobile.newsletterTop, mobile.newsletter.y);
  near(arrival.diameter, mobile.newsletter.diameter);

  const samples = [];
  for (let scroll = mobile.storyExit; scroll <= mobile.newsletterTop; scroll += 4) {
    const result = mobileRoute(scroll);
    samples.push(scroll);
    assert.ok(result.y >= 0 && result.y <= mobile.viewportHeight, `coin center left viewport at scroll ${scroll}`);
    assert.ok(result.y + result.diameter / 2 > 0 && result.y - result.diameter / 2 < mobile.viewportHeight);
    assert.ok(result.x - result.diameter / 2 >= 0 && result.x + result.diameter / 2 <= 390);
  }
  for (const boundary of [mobile.heroEnd, mobile.storyExit, mobile.budgetDock, mobile.newsletterDeparture, mobile.newsletterTop]) {
    const at = mobileRoute(boundary);
    for (const scroll of [boundary - 1e-6, boundary + 1e-6]) {
      const adjacent = mobileRoute(scroll);
      for (const property of ['x', 'y', 'diameter', 'turn']) near(adjacent[property], at[property], 3e-6);
    }
  }
  const forward = samples.map(mobileRoute);
  const reverse = [...samples].reverse().map(mobileRoute).reverse();
  assert.deepEqual(reverse, forward);
});

test('the closest visible coin is chosen in two dimensions, with stable ties', () => {
  const center = { x: 100, y: 100 };
  assert.equal(closestToCenter([{ x: 100, y: 0 }, { x: 150, y: 100 }, { x: 120, y: 110 }], center), 2);
  assert.equal(closestToCenter([{ x: 90, y: 100 }, { x: 110, y: 100 }], center), 0);
  assert.equal(closestToCenter([{ x: 100, y: 100, visible: false }, { x: 103, y: 104 }], center), 1);
  assert.equal(closestToCenter([{ x: NaN, y: 0 }, { x: Infinity, y: 10 }], center), -1);
  assert.equal(closestToCenter([], center), -1);
});

test('invalid route anchors and backwards section timing fail explicitly', () => {
  assert.throws(() => route(NaN), TypeError);
  assert.throws(() => route(800, { ...geometry, story: { x: 100, y: 100, diameter: 0 } }), TypeError);
  assert.throws(() => route(800, { ...geometry, storyExit: 500 }), RangeError);
  assert.throws(() => route(800, { ...geometry, newsletterDeparture: 2900 }), RangeError);
  assert.throws(() => route(800, { ...geometry, budgetDock: geometry.storyExit }), RangeError);
  assert.throws(() => route(800, { ...geometry, newsletterDeparture: geometry.newsletterTop }), RangeError);
});

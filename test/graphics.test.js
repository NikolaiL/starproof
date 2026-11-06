import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyFrame, drawJourney, drawConfetti, drawPlanet, drawMonster, shipHeading, journeyHeading } from '../public/graphics.js';
import { SECTORS } from '../public/protocol.js';

test('travel progresses from departure through warp to arrival without overshooting', () => {
  assert.deepEqual(journeyFrame(-1), { progress: 0, phase: 'departure', t: 0 });
  assert.equal(journeyFrame(700).phase, 'warp');
  assert.deepEqual(journeyFrame(2000), { progress: 1, phase: 'arrival', t: 1 });
  let previous = 0;
  for (let age = 0; age <= 1500; age += 15) {
    const { progress } = journeyFrame(age);
    assert.ok(progress >= previous && progress <= 1);
    previous = progress;
  }
});

test('all worlds, creatures and reward effects draw finite coordinates and restore canvas state', () => {
  let depth = 0, calls = 0;
  const draw = (...args) => { calls++; for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value)); };
  const gradient = { addColorStop: draw };
  const g = new Proxy({
    save() { depth++; }, restore() { depth--; assert.ok(depth >= 0); },
    createRadialGradient(...args) { draw(...args); return gradient; },
    createLinearGradient(...args) { draw(...args); return gradient; },
  }, { get(target, key) { return target[key] ?? draw; }, set(target, key, value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); target[key] = value; return true; } });
  for (const world of SECTORS) {
    drawPlanet(g, world, 150, 100, 30, 850);
    if (world.monster) drawMonster(g, world.monster, 170, 80, 24, 850, true);
    assert.equal(depth, 0);
  }
  for (const age of [0, 700, 1300]) {
    drawJourney(g, { x: 50, y: 100 }, { x: 300, y: 200 }, 400, 350, age);
    drawConfetti(g, { x: 200, y: 150 }, age);
    assert.equal(depth, 0);
  }
  drawJourney(g, { x: 0, y: 0 }, { x: 300, y: 200 }, 400, 350, 1400, true);
  const before = calls;
  drawConfetti(g, { x: 200, y: 150 }, 3000);
  assert.equal(calls, before, 'expired celebrations must stop drawing');
  assert.equal(depth, 0);
});

test('rocket headings point up, right, down and left with keyboard direction', () => {
  assert.equal(shipHeading(0, -1), 0);
  assert.equal(shipHeading(1, 0), Math.PI / 2);
  assert.equal(shipHeading(0, 1), Math.PI);
  assert.equal(shipHeading(-1, 0), Math.PI * 1.5);
  assert.equal(shipHeading(1, -1), Math.PI / 4);
});

test('animated travel follows its curved path through arrival', () => {
  const from={x:0,y:0},to={x:400,y:0};
  assert.ok(Math.abs(journeyHeading(from,to,.5)-Math.PI/2)<1e-9);
  assert.ok(journeyHeading(from,to,1)>Math.PI/2, 'arrival must keep following the curve, not snap upright');
});

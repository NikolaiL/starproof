import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPoint, planetAction } from '../public/navigation.js';
import { chartBounds, chartedWorlds } from '../public/protocol.js';

test('planet controls distinguish collecting, revisiting, insufficient fuel and device readiness', () => {
  const state = { started: true, location: 'sol', claims: [], fuel: 2 };
  assert.deepEqual(planetAction(state, 'sol', true, false), {
    action: 'claim', text: 'Collect artifact +4', status: 'Artifact available', disabled: false,
  });
  assert.equal(planetAction(state, 'kepler', true, false).disabled, false);
  assert.match(planetAction(state, 'moss', true, false).text, /Need 8 fuel/);
  assert.equal(planetAction(state, 'moss', true, false).disabled, true);
  for (const [started, ready, busy] of [[false, true, false], [true, false, false], [true, true, true]]) {
    assert.equal(planetAction({ ...state, started }, 'sol', ready, busy).disabled, true);
  }
  const claimed = { ...state, claims: ['sol', 'kepler'] };
  assert.equal(planetAction(claimed, 'sol', true, false).disabled, true);
  assert.deepEqual(planetAction(claimed, 'kepler', true, false), {
    action: 'jump', text: 'Travel · 2 fuel', status: 'Artifact secured', disabled: false,
  });
});

test('planet labels and controls fit without overlapping across chart sizes and discoveries', () => {
  for (const [width, height, controlWidth, controlHeight] of [[298, 520, 104, 82], [368, 520, 112, 82], [660, 520, 112, 87], [740, 460, 112, 87], [1034, 460, 112, 87], [1214, 365, 156, 87]]) {
    for (const maps of [['home'], ['home', 'nebula'], ['home', 'nebula', 'frontier']]) {
      const worlds = chartedWorlds(maps), bounds = chartBounds(worlds);
      const controls = worlds.map((world) => {
        const point = mapPoint(world, bounds, width, height);
        const top = point.y + (width < 760 ? 24 : 44.4);
        return { id: world.id, left: point.x - controlWidth / 2, top, right: point.x + controlWidth / 2, bottom: top + controlHeight };
      });
      for (const a of controls) {
        assert.ok(a.left >= 0 && a.right <= width && a.top >= 0 && a.bottom <= height, `${width}px: ${a.id} stays inside the map`);
        for (const b of controls) if (a.id !== b.id) {
          assert.ok(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom, `${width}px: ${a.id} and ${b.id} controls overlap`);
        }
      }
    }
  }
});

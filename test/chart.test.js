import test from 'node:test';
import assert from 'node:assert/strict';
import { chartedWorlds, chartBounds, SECTORS } from '../public/protocol.js';

test('one chart expands with recovered maps and keeps earlier stars in the same universe', () => {
  let previous;
  for (const [maps, count] of [[['home'], 2], [['home', 'nebula'], 4], [['home', 'nebula', 'frontier'], 6]]) {
    const stars = chartedWorlds(maps), bounds = chartBounds(stars);
    assert.equal(stars.length, count);
    assert.equal(new Set(stars.map((star) => `${star.x},${star.y}`)).size, count);
    for (const star of stars) {
      assert.equal(star, SECTORS.find((item) => item.id === star.id));
      assert.ok(star.x > bounds.left && star.x < bounds.left + bounds.width);
      assert.ok(star.y > bounds.top && star.y < bounds.top + bounds.height);
    }
    if (previous) {
      assert.ok(bounds.left <= previous.left && bounds.top <= previous.top);
      assert.ok(bounds.left + bounds.width >= previous.left + previous.width);
      assert.ok(bounds.top + bounds.height >= previous.top + previous.height);
    }
    previous = bounds;
  }
  const stars = chartedWorlds(['home', 'nebula', 'frontier']), bounds = chartBounds(stars);
  for (const a of stars) for (const b of stars) if (a !== b) {
    const distance = Math.hypot((a.x - b.x) / bounds.width * 320, (a.y - b.y) / bounds.height * 365);
    assert.ok(distance > 60, 'planets must stay distinct on a narrow chart');
  }
});

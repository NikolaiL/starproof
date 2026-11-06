import test from 'node:test';
import assert from 'node:assert/strict';
import { chartedWorlds, chartBounds, SECTORS, MAPS } from '../public/protocol.js';

test('one chart expands with recovered maps and keeps earlier stars in the same universe', () => {
  let previous;
  for (const [maps, count] of MAPS.map((_, i) => [MAPS.slice(0, i + 1).map(m => m.id), [4, 6, 8, 12, 16, 20][i]])) {
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
      assert.ok(bounds.left + bounds.width >= previous.left + previous.width - 1e-9);
      assert.ok(bounds.top + bounds.height >= previous.top + previous.height - 1e-9);
    }
    previous = bounds;
  }
  assert.equal(SECTORS.length, 20);
  assert.equal(SECTORS.filter(world => world.monster).length, 18);
  assert.equal(new Set(SECTORS.filter(world => world.monster).map(world => world.monster)).size, 5);
  assert.ok(SECTORS.some(world => world.x < -4) && SECTORS.some(world => world.x > 3));
  assert.ok(SECTORS.some(world => world.y < -4) && SECTORS.some(world => world.y > 4));
});

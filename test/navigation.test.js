import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPoint, planetAction, focusCamera, smoothCamera, followCamera } from '../public/navigation.js';
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

test('galaxy view fits all worlds and focused cameras preserve north, south and selected position', () => {
  const worlds = chartedWorlds(['home', 'nebula', 'frontier', 'north', 'south', 'west']);
  const bounds = chartBounds(worlds);
  for (const [width, height] of [[298, 520], [368, 520], [740, 460], [1214, 365]]) {
    for (const world of worlds) {
      const overview = mapPoint(world, bounds, width, height);
      assert.ok(overview.x > 0 && overview.x < width && overview.y > 0 && overview.y < height);
      const camera = focusCamera(world, bounds, width, height);
      assert.deepEqual(mapPoint(world, bounds, width, height, camera), { x: width / 2, y: height / 2 });
      assert.ok(camera.zoom >= 1 && camera.zoom <= 6);
      const east = mapPoint({ x: world.x + 1, y: world.y }, bounds, width, height, camera);
      const north = mapPoint({ x: world.x, y: world.y - 1 }, bounds, width, height, camera);
      assert.ok(east.x > width / 2 && north.y < height / 2);
    }
  }
});

test('camera zoom and pan ease toward the target without overshooting, with a reduced-motion snap', () => {
  const start = { x: 0, y: 3, zoom: 1 }, target = { x: 4, y: -2, zoom: 3 };
  const next = smoothCamera(start, target, 1 / 60);
  assert.ok(next.x > 0 && next.x < 4 && next.zoom > 1 && next.zoom < 3);
  let view = start;
  for (let i = 0; i < 90; i++) view = smoothCamera(view, target, 1 / 60);
  assert.ok(Math.abs(view.zoom - target.zoom) < .0001 && Math.abs(view.x - target.x) < .0001);
  assert.deepEqual(smoothCamera(start, target, 0, true), target);
  assert.deepEqual(smoothCamera(start, target, 0), start);
});

test('flight camera keeps the rocket inside every edge at mobile and desktop zoom levels', () => {
  const bounds = chartBounds(chartedWorlds(['home', 'nebula', 'frontier', 'north', 'south', 'west']));
  for (const [width, height] of [[298, 520], [740, 460], [1214, 365]]) {
    for (const zoom of [.6, 1, 6]) {
      const camera = { x: 0, y: 0, zoom };
      assert.equal(followCamera({ x: 0, y: 0 }, bounds, width, height, camera), camera, 'do not move a camera while the ship is safely inside');
      for (const ship of [{ x: 20, y: 0 }, { x: -20, y: 0 }, { x: 0, y: -20 }, { x: 0, y: 20 }, { x: 20, y: -20 }]) {
        const followed = followCamera(ship, bounds, width, height, camera);
        const point = mapPoint(ship, bounds, width, height, followed);
        assert.equal(followed.zoom, zoom);
        assert.ok(point.x >= 96 - 1e-9 && point.x <= width - 96 + 1e-9);
        assert.ok(point.y >= 96 - 1e-9 && point.y <= height - 96 + 1e-9);
      }
    }
  }
});

test('following corrects both camera lag and zoom transitions, including after movement stops', () => {
  const bounds = { left: -5, top: -5, width: 10, height: 10 }, ship = { x: 0, y: 0 };
  const width = 360, height = 520;
  let target = { x: 8, y: -8, zoom: 6 }, view = { x: -8, y: 8, zoom: .6 };
  for (let frame = 0; frame < 240; frame++) {
    if (frame < 120) { ship.x += .01; ship.y -= .01; }
    view = smoothCamera(view, target, 1 / 60);
    target = followCamera(ship, bounds, width, height, target);
    view = followCamera(ship, bounds, width, height, view);
    const point = mapPoint(ship, bounds, width, height, view);
    assert.ok(point.x >= 96 - 1e-9 && point.x <= width - 96 + 1e-9);
    assert.ok(point.y >= 96 - 1e-9 && point.y <= height - 96 + 1e-9);
  }
  assert.equal(target.zoom, 6);
});

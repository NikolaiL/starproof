import { jumpCost } from './protocol.js';

export function mapPoint(world, bounds, width, height) {
  const u = (world.x - bounds.left) / bounds.width;
  const v = (world.y - bounds.top) / bounds.height;
  const side = width < 330 ? 56 : width < 500 ? 62 : 72;
  // Portrait charts rotate the same coordinates, reserving room for each planet's controls.
  if (width < 760) return {
    x: side + (world.y - bounds.top - .65) / (bounds.height - 1.35) * (width - side * 2),
    y: 43 + (world.x - bounds.left - .6) / (bounds.width - 1.2) * (height - 155),
  };
  return { x: 40 + u * (width - 80), y: 35 + v * (height - 160) };
}

export function planetAction(state, id, ready, busy) {
  const here = id === state.location, claimed = state.claims.includes(id);
  const cost = here ? 0 : jumpCost(state.location, id);
  return {
    action: here ? 'claim' : 'jump',
    text: here ? (claimed ? 'Artifact collected' : 'Collect artifact +4') : (state.fuel < cost ? 'Need ' + cost + ' fuel' : 'Travel · ' + cost + ' fuel'),
    status: claimed ? 'Artifact secured' : 'Artifact available',
    disabled: busy || !ready || !state.started || (here ? claimed : state.fuel < cost),
  };
}

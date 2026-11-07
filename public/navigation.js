import { jumpCost } from './protocol.js';

export function mapPoint(world, bounds, width, height, camera) {
  const zoom = camera?.zoom ?? 1;
  const x = camera?.x ?? bounds.left + bounds.width / 2;
  const y = camera?.y ?? bounds.top + bounds.height / 2;
  const scale = Math.min(width / bounds.width, height / bounds.height) * zoom;
  return { x: width / 2 + (world.x - x) * scale, y: height / 2 + (world.y - y) * scale };
}

export function focusCamera(world, bounds, width, height) {
  return { x: world.x, y: world.y, zoom: Math.max(1, Math.min(6, (width < 760 ? 135 : 160) / Math.min(width / bounds.width, height / bounds.height))) };
}

export function smoothCamera(current, target, dt, reducedMotion = false) {
  const blend = reducedMotion ? 1 : 1 - Math.exp(-12 * Math.max(0, dt));
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend,
    zoom: current.zoom + (target.zoom - current.zoom) * blend };
}

export function followCamera(ship, bounds, width, height, camera) {
  const scale = Math.min(width / bounds.width, height / bounds.height) * camera.zoom;
  if (scale <= 0) return camera;
  const point = mapPoint(ship, bounds, width, height, camera);
  const margin = Math.min(96, width / 2, height / 2);
  const dx = point.x - Math.max(margin, Math.min(width - margin, point.x));
  const dy = point.y - Math.max(margin, Math.min(height - margin, point.y));
  return dx || dy ? { ...camera, x: camera.x + dx / scale, y: camera.y + dy / scale } : camera;
}

export function planetAction(state, id, ready, busy) {
  const here = id === state.location, claimed = state.claims.includes(id);
  const cost = here ? 0 : jumpCost(state.location, id);
  const action = here ? 'claim' : 'jump';
  return {
    action,
    text: here ? (claimed ? 'Artifact collected' : 'Collect artifact +4') : (state.fuel < cost ? 'Need ' + cost + ' fuel' : 'Travel · ' + cost + ' fuel'),
    status: claimed ? 'Artifact secured' : 'Artifact available',
    disabled: busy || (!ready && state.confirmations?.[action] !== false) || !state.started || (here ? claimed : state.fuel < cost),
  };
}

export function planetControls(point, radius, width, height, offset) {
  const dx = Math.max(0, -point.x, point.x - width), dy = Math.max(0, -point.y, point.y - height);
  return {
    visible: width > 0 && height > 0 && dx * dx + dy * dy <= radius * radius,
    x: point.x,
    y: point.y + offset,
  };
}

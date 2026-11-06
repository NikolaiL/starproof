import { SECTORS } from './protocol.js';

// World IDs match the device's existing planet order; do not renumber issued collectibles.
export const MONSTERS = SECTORS.map((world, index) => ({ ...world, worldId: index + 1 })).filter(world => world.monster);

export function hasEncounterProof(receipt) {
  // Older signed receipts predate the verification label; their signatures are still checked by the server.
  return receipt.action === 'claim' && (receipt.verification === undefined || receipt.verification === 'trustm')
    && ['text', 'r', 's', 'cert', 'fingerprint'].every(key => typeof receipt[key] === 'string' && receipt[key].length > 0);
}

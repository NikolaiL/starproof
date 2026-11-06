export const MAPS = [
  { id: 'home', name: 'Home Signal', foundAt: null },
  { id: 'nebula', name: 'Nebula Reach', foundAt: 'kepler' },
  { id: 'frontier', name: 'Wild Frontier', foundAt: 'lyra' },
];
export const MAX_FUEL = 8;
export const FUEL_PRICE = 4;
export const START_CREDITS = 8;
export const SCAVENGE_FUEL = 2;
export const ECONOMY_VERSION = 2;
export const SECTORS = [
  { id: 'sol', name: 'Sol', x: 0, y: 0, color: '#ffcb70', world: 'Luna', description: 'Home sweet home. Grab your space snacks. It gets weird from here.', artifact: 'Lunar archive' },
  { id: 'kepler', name: 'Kepler', x: .9, y: -.6, color: '#a5fbb3', world: 'Kepler-62f', description: 'An ocean planet. One very nosy jelly. Absolutely no personal space.', artifact: 'Ocean prism', monster: 'jelly', resident: 'The Jelly Sentinel', greeting: 'BLORP? New friend?', residentNote: 'A sonar scan makes it do a little dance.' },
  { id: 'vega', name: 'Vega', x: 1.7, y: .5, color: '#bda6ff', world: 'Vega III', description: 'Purple mountains. Suspicious footprints. Someone ate the landing pad.', artifact: 'Stellar compass', monster: 'chomper', resident: 'The Moon Muncher', greeting: 'IS THAT A SPACE SNACK?', residentNote: 'Big teeth. Bigger feelings. Try saying hello with a scan.' },
  { id: 'lyra', name: 'Lyra', x: 2.4, y: -.9, color: '#ff8cba', world: 'Lyra IX', description: 'Pink rings and perfect silence. Even the monsters take a day off.', artifact: 'Echo capsule' },
  { id: 'cinder', name: 'Cinder', x: 3.2, y: .3, color: '#ff9365', world: 'Cinder IV', description: 'Lava lakes, toasted marshmallows and one extremely warm welcome.', artifact: 'Ember seed', monster: 'chomper', resident: 'The Toast Goblin', greeting: 'EXTRA CRISPY!', residentNote: 'A sonar ping wakes it from a very spicy nap.' },
  { id: 'moss', name: 'Moss', x: 4, y: -.5, color: '#8be6d8', world: 'Moss II', description: 'An entire moon wearing a fuzzy green sweater. The sweater is alive.', artifact: 'Living atlas', monster: 'jelly', resident: 'The Moss Warden', greeting: 'WELCOME, TINY FRIEND.', residentNote: 'Nobody has visited this far out in a very long time.' },
].map((world, index) => ({ ...world, map: index < 2 ? 'home' : index < 4 ? 'nebula' : 'frontier' }));
export const sector = (id) => SECTORS.find((item) => item.id === id);
export const PROTOCOL = 'starproof/v1';
export const CHALLENGE_MS = 90_000;

export const DEVICE_VERSION = '0.3.0';

export function jumpCost(from, to) {
  const a = sector(from), b = sector(to);
  return Math.max(2, Math.min(MAX_FUEL, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 1.8)));
}

export function chartedWorlds(maps) {
  return SECTORS.filter((world) => maps.includes(world.map));
}

export function chartBounds(worlds) {
  const left = Math.min(...worlds.map((world) => world.x)) - .6;
  const top = Math.min(...worlds.map((world) => world.y)) - .65;
  return { left, top, width: Math.max(...worlds.map((world) => world.x)) + .6 - left,
    height: Math.max(...worlds.map((world) => world.y)) + .7 - top };
}

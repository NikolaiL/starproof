export const MAPS = [
  { id: 'home', name: 'Home Signal', foundAt: null },
  { id: 'nebula', name: 'Nebula Reach', foundAt: 'kepler' },
  { id: 'frontier', name: 'Wild Frontier', foundAt: 'lyra' },
];
export const MAX_FUEL = 1;
export const FUEL_PRICE = 3;
export const SECTORS = [
  { id: 'sol', name: 'Sol', x: .28, y: .57, color: '#ffcb70', world: 'Luna', description: 'Home sweet home. Grab your space snacks. It gets weird from here.', artifact: 'Lunar archive' },
  { id: 'kepler', name: 'Kepler', x: .68, y: .3, color: '#a5fbb3', world: 'Kepler-62f', description: 'An ocean planet. One very nosy jelly. Absolutely no personal space.', artifact: 'Ocean prism', monster: 'jelly', resident: 'The Jelly Sentinel', greeting: 'BLORP? New friend?', residentNote: 'A sonar scan makes it do a little dance.' },
  { id: 'vega', name: 'Vega', x: .28, y: .57, color: '#bda6ff', world: 'Vega III', description: 'Purple mountains. Suspicious footprints. Someone ate the landing pad.', artifact: 'Stellar compass', monster: 'chomper', resident: 'The Moon Muncher', greeting: 'IS THAT A SPACE SNACK?', residentNote: 'Big teeth. Bigger feelings. Try saying hello with a scan.' },
  { id: 'lyra', name: 'Lyra', x: .7, y: .3, color: '#ff8cba', world: 'Lyra IX', description: 'Pink rings and perfect silence. Even the monsters take a day off.', artifact: 'Echo capsule' },
  { id: 'cinder', name: 'Cinder', x: .3, y: .57, color: '#ff9365', world: 'Cinder IV', description: 'Lava lakes, toasted marshmallows and one extremely warm welcome.', artifact: 'Ember seed', monster: 'chomper', resident: 'The Toast Goblin', greeting: 'EXTRA CRISPY!', residentNote: 'A sonar ping wakes it from a very spicy nap.' },
  { id: 'moss', name: 'Moss', x: .7, y: .3, color: '#8be6d8', world: 'Moss II', description: 'An entire moon wearing a fuzzy green sweater. The sweater is alive.', artifact: 'Living atlas', monster: 'jelly', resident: 'The Moss Warden', greeting: 'WELCOME, TINY FRIEND.', residentNote: 'Nobody has visited this far out in a very long time.' },
].map((world, index) => ({ ...world, map: index < 2 ? 'home' : index < 4 ? 'nebula' : 'frontier' }));
export const sector = (id) => SECTORS.find((item) => item.id === id);
export const PROTOCOL = 'starproof/v1';
export const CHALLENGE_MS = 90_000;

export const DEVICE_VERSION = '0.2.0';

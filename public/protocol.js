export const MAPS = [
  { id: 'home', name: 'Home Signal', foundAt: null },
  { id: 'nebula', name: 'Nebula Reach', foundAt: 'kepler' },
  { id: 'frontier', name: 'Wild Frontier', foundAt: 'lyra' },
  { id: 'north', name: 'Aurora Drift', foundAt: 'moss' },
  { id: 'south', name: 'Ember Expanse', foundAt: 'cinder' },
  { id: 'west', name: 'Midnight Verge', foundAt: 'borealis' },
];
export const MAX_FUEL = 8;
export const FUEL_PRICE = 4;
export const START_CREDITS = 8;
export const SCAVENGE_FUEL = 2;
export const ECONOMY_VERSION = 2;
export const SECTORS = [
  { id: 'sol', name: 'Sol', x: 0, y: 0, color: '#ffcb70', world: 'Luna', description: 'Home sweet home. Grab your space snacks. It gets weird from here.', artifact: 'Lunar archive', map: 'home' },
  { id: 'kepler', name: 'Kepler', x: .9, y: -.6, color: '#a5fbb3', world: 'Kepler-62f', description: 'An ocean planet. One very nosy jelly. Absolutely no personal space.', artifact: 'Ocean prism', monster: 'jelly', resident: 'The Jelly Sentinel', greeting: 'BLORP? New friend?', residentNote: 'A sonar scan makes it do a little dance.', map: 'home' },
  { id: 'vega', name: 'Vega', x: 1.7, y: .5, color: '#bda6ff', world: 'Vega III', description: 'Purple mountains. Suspicious footprints. Someone ate the landing pad.', artifact: 'Stellar compass', monster: 'chomper', resident: 'The Moon Muncher', greeting: 'IS THAT A SPACE SNACK?', residentNote: 'Big teeth. Bigger feelings. Try saying hello with a scan.', map: 'nebula' },
  { id: 'lyra', name: 'Lyra', x: 2.4, y: -.9, color: '#ff8cba', world: 'Lyra IX', description: 'Pink rings and perfect silence. Even the monsters take a day off.', artifact: 'Echo capsule', map: 'nebula' },
  { id: 'cinder', name: 'Cinder', x: 3.2, y: .3, color: '#ff9365', world: 'Cinder IV', description: 'Lava lakes, toasted marshmallows and one extremely warm welcome.', artifact: 'Ember seed', monster: 'chomper', resident: 'The Toast Goblin', greeting: 'EXTRA CRISPY!', residentNote: 'A sonar ping wakes it from a very spicy nap.', map: 'frontier' },
  { id: 'moss', name: 'Moss', x: 4, y: -.5, color: '#8be6d8', world: 'Moss II', description: 'An entire moon wearing a fuzzy green sweater. The sweater is alive.', artifact: 'Living atlas', monster: 'jelly', resident: 'The Moss Warden', greeting: 'WELCOME, TINY FRIEND.', residentNote: 'Nobody has visited this far out in a very long time.', map: 'frontier' },
  {"id": "orion", "name": "Orion", "x": -1.4, "y": -1.2, "color": "#ffb98a", "world": "Orion Belt", "description": "A dusty moon with a diner. The chef has six elbows.", "artifact": "Comet spoon", "monster": "crab", "resident": "The Snackonaut", "greeting": "SPECIAL TODAY: STARDUST!", "residentNote": "Orders a snack every time you scan.", "map": "home"},
  {"id": "nova", "name": "Nova", "x": -1.6, "y": 1.1, "color": "#ffd668", "world": "Nova Prime", "description": "Everything glows here. Especially the extremely round wildlife.", "artifact": "Sun marble", "monster": "cyclops", "resident": "The Solar Peeper", "greeting": "I SEE A NEW FRIEND!", "residentNote": "One enormous eye. Zero personal boundaries.", "map": "home"},
  {"id": "borealis", "name": "Borealis", "x": -0.4, "y": -3.2, "color": "#80ffd8", "world": "Borealis I", "description": "The northern lights have a guardian. It loves shiny things.", "artifact": "Aurora ribbon", "monster": "moth", "resident": "The Neon Flutter", "greeting": "FOLLOW THE GLOW!", "residentNote": "Its wings hold a map to the Midnight Verge.", "map": "north"},
  {"id": "glacier", "name": "Glacier", "x": 1.9, "y": -3.6, "color": "#a8e7ff", "world": "Glacier VII", "description": "Ice mountains and a creature wearing absolutely no scarf.", "artifact": "Frozen hourglass", "monster": "cyclops", "resident": "The Snowball", "greeting": "COOL TO MEET YOU!", "residentNote": "It blinks in slow motion.", "map": "north"},
  {"id": "aurora", "name": "Aurora", "x": -2.6, "y": -3.2, "color": "#eca3ff", "world": "Aurora II", "description": "A violet cloud ocean. The clouds appear to be giggling.", "artifact": "Cloud lantern", "monster": "jelly", "resident": "The Cloud Noodle", "greeting": "FLOAT WITH ME!", "residentNote": "Possibly made of weather.", "map": "north"},
  {"id": "polaris", "name": "Polaris", "x": 0.8, "y": -5.3, "color": "#e1efff", "world": "Polaris Outpost", "description": "The last bright beacon before the great cold nothing.", "artifact": "Northstar crown", "monster": "crab", "resident": "The Frost Admiral", "greeting": "PERMISSION TO BLORP?", "residentNote": "Runs a very tiny navy.", "map": "north"},
  {"id": "vulcan", "name": "Vulcan", "x": 1.2, "y": 2.6, "color": "#ff867a", "world": "Vulcan IX", "description": "The ground is lava. The locals consider this a feature.", "artifact": "Magma heart", "monster": "chomper", "resident": "The Lava Loaf", "greeting": "TOASTY LITTLE SHIP!", "residentNote": "Always a little overcooked.", "map": "south"},
  {"id": "ember", "name": "Ember", "x": 3.3, "y": 2.5, "color": "#ffbf6c", "world": "Ember Moon", "description": "A warm orange world with a thriving space-crab community.", "artifact": "Cinder pearl", "monster": "crab", "resident": "The Ember Claw", "greeting": "HIGH FIVE? HIGH SIX?", "residentNote": "Collects tiny volcanic rocks.", "map": "south"},
  {"id": "dune", "name": "Dune", "x": -1.2, "y": 3.3, "color": "#edcf88", "world": "Dune IV", "description": "Golden sands. Suspiciously large footprints. Excellent sunsets.", "artifact": "Sandglass seed", "monster": "cyclops", "resident": "The Dune Dumpling", "greeting": "SANDWICH?", "residentNote": "Frequently mistaken for a hill.", "map": "south"},
  {"id": "mirage", "name": "Mirage", "x": 1.3, "y": 4.7, "color": "#ff99d9", "world": "Mirage Oasis", "description": "A pink oasis so pretty even the monsters take selfies.", "artifact": "Prism bloom", "monster": "moth", "resident": "The Glitter Drifter", "greeting": "LOOK AT MY WINGS!", "residentNote": "Leaves a trail of cosmic glitter.", "map": "south"},
  {"id": "umbra", "name": "Umbra", "x": -4.7, "y": -0.8, "color": "#a89bff", "world": "Umbra Hollow", "description": "The shadows move. Fortunately, they are rather friendly.", "artifact": "Shadow key", "monster": "jelly", "resident": "The Midnight Pudding", "greeting": "BOO! ...FRIENDLY BOO.", "residentNote": "Afraid of its own shadow.", "map": "west"},
  {"id": "nyx", "name": "Nyx", "x": -4.8, "y": 1.7, "color": "#84b1ff", "world": "Nyx VI", "description": "A blue midnight world where the stars seem much too close.", "artifact": "Night compass", "monster": "moth", "resident": "The Moonwing", "greeting": "YOU BROUGHT THE LIGHT!", "residentNote": "Navigates by borrowed starlight.", "map": "west"},
  {"id": "echo", "name": "Echo", "x": -4.6, "y": -3.2, "color": "#8bddd7", "world": "Echo Vault", "description": "Every sound comes back with a slightly sillier accent.", "artifact": "Whisper stone", "monster": "crab", "resident": "The Echo Scuttler", "greeting": "HELLO... ELLO... BLORP!", "residentNote": "Repeats every sonar ping twice.", "map": "west"},
  {"id": "rift", "name": "Rift", "x": -6.8, "y": 0.5, "color": "#f99bff", "world": "Rift Zero", "description": "The edge of the map. A monster has been waiting for company.", "artifact": "Infinity pebble", "monster": "cyclops", "resident": "The Void Friend", "greeting": "YOU FINALLY MADE IT!", "residentNote": "Keeper of the universe’s smallest secret.", "map": "west"},
];
export const sector = (id) => SECTORS.find((item) => item.id === id);
export const PROTOCOL = 'starproof/v1';
export const CHALLENGE_MS = 90_000;

export const DEVICE_VERSION = '0.4.3';

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

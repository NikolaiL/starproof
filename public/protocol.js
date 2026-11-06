export const SECTORS = [
  { id: 'sol', name: 'Sol', x: 0.23, y: 0.54, color: '#ffd398', world: 'Luna', description: 'Home signal. The last familiar light.', artifact: 'Lunar archive' },
  { id: 'kepler', name: 'Kepler', x: 0.52, y: 0.26, color: '#8ce8c9', world: 'Kepler-62f', description: 'An ocean world with a signal beneath the ice.', artifact: 'Ocean prism' },
  { id: 'vega', name: 'Vega', x: 0.78, y: 0.53, color: '#a8baff', world: 'Vega III', description: 'Blue dust, broken satellites, one persistent beacon.', artifact: 'Stellar compass' },
  { id: 'lyra', name: 'Lyra', x: 0.49, y: 0.78, color: '#f0a7c7', world: 'Lyra IX', description: 'A quiet outpost on the edge of the chart.', artifact: 'Echo capsule' },
];
export const sector = (id) => SECTORS.find((item) => item.id === id);
export const PROTOCOL = 'starproof/v1';
export const CHALLENGE_MS = 90_000;

import { mkdir, writeFile } from 'node:fs/promises';
import { drawMonster } from '../public/graphics.js';
import { MONSTERS } from '../public/monster-catalog.js';

// Record the game's existing canvas paths as static SVG so the NFT art stays identical.
function svgContext() {
  const parts = [], stack = [];
  const g = { fillStyle: '#17152d', strokeStyle: '#17152d', lineWidth: 3, lineCap: 'round', transform: '', path: '',
    save() { stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, transform: this.transform }); },
    restore() { Object.assign(this, stack.pop()); },
    translate(x, y) { this.transform += ` translate(${x} ${y})`; },
    rotate(angle) { this.transform += ` rotate(${angle * 180 / Math.PI})`; },
    scale(x, y) { this.transform += ` scale(${x} ${y})`; },
    beginPath() { this.path = ''; },
    moveTo(x, y) { this.path += `M${x} ${y}`; },
    lineTo(x, y) { this.path += `L${x} ${y}`; },
    bezierCurveTo(...p) { this.path += 'C' + p.join(' '); },
    quadraticCurveTo(...p) { this.path += 'Q' + p.join(' '); },
    closePath() { this.path += 'Z'; },
    ellipse(x, y, rx, ry) { this.path += `M${x + rx} ${y}A${rx} ${ry} 0 1 0 ${x - rx} ${y}A${rx} ${ry} 0 1 0 ${x + rx} ${y}Z`; },
    arc(x, y, r, start, end) { this.moveTo(x + Math.cos(start) * r, y + Math.sin(start) * r); this.path += `A${r} ${r} 0 0 1 ${x + Math.cos(end) * r} ${y + Math.sin(end) * r}`; },
    fill() { parts.push(`<path d="${this.path}" transform="${this.transform}" fill="${this.fillStyle}"/>`); },
    stroke() { parts.push(`<path d="${this.path}" transform="${this.transform}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="round"/>`); },
  };
  return { g, parts };
}
const root = new URL('../public/monsters/', import.meta.url);
await mkdir(root, { recursive: true });
for (const monster of MONSTERS) {
  const { g, parts } = svgContext();
  drawMonster(g, monster.monster, 200, 185, 125, 0);
  const title = monster.resident.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  await writeFile(new URL(monster.worldId + '.svg', root), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img"><title>${title}</title><rect width="400" height="400" rx="32" fill="#eeeafa"/>${parts.join('')}<text x="200" y="365" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#17152d">${title}</text></svg>`);
  await writeFile(new URL(monster.worldId + '.json', root), JSON.stringify({ name: monster.resident,
    description: `A Starproof encounter from ${monster.name}. Minted after a server-verified certified-chip artifact claim. The issuer is trusted; this is not firmware attestation.`,
    image: `https://starproof-wedgie.vercel.app/monsters/${monster.worldId}.svg`,
    external_url: 'https://starproof-wedgie.vercel.app/',
    attributes: [{ trait_type: 'World', value: monster.name }, { trait_type: 'Species', value: monster.monster }],
  }, null, 2) + '\n');
}

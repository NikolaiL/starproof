const INK = '#17152d';
function ellipse(g, x, y, rx, ry, color) {
  g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

export function drawMonster(g, kind, x, y, size, time, startled = false) {
  const t = time / 1000;
  g.save(); g.translate(x, y + Math.sin(t * 2.6) * size * .07); g.rotate(Math.sin(t * 1.8) * (startled ? .18 : .04)); g.scale(size / 50, size / 50);
  const color = ({ jelly: '#adff7f', chomper: '#ff9cc8', cyclops: '#ffcf75', crab: '#ffa782', moth: '#c8a1ff' })[kind];
  g.lineWidth = 3; g.strokeStyle = INK; g.lineCap = 'round';
  if (kind === 'cyclops' || kind === 'crab' || kind === 'moth') {
    if (kind === 'moth') {
      for (const side of [-1, 1]) {
        g.save(); g.rotate(side * Math.sin(t * 3) * .14);
        ellipse(g, side * 30, -5, 30, 39, '#baa0ff'); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
        ellipse(g, side * 32, -9, 18, 25, '#ffb2df');
        ellipse(g, side * 33, -16, 8, 11, '#fff2ae');
        g.restore();
      }
      ellipse(g, 0, 8, 17, 35, '#9de9df'); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 8, -17); g.quadraticCurveTo(side * 8, -37, side * 22, -44); g.stroke(); ellipse(g, side * 22, -44, 5, 5, '#fff2ae'); }
    } else {
      if (kind === 'crab') for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(side * 22, 12 + i * 7); g.lineTo(side * (45 + i * 3), 7 + i * 11); g.lineTo(side * 49, 26 + i * 9); g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = color; g.lineWidth = 6; g.stroke(); }
        ellipse(g, side * 42, -14, 16, 19, color); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
        g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(side * 42, -34); g.lineTo(side * 42, -14); g.stroke();
      }
      ellipse(g, 0, 7, 35, 36, color); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      ellipse(g, -12, -18, 12, 5, '#fff3bd');
    }
    if (kind === 'cyclops') {
      ellipse(g, 0, -2, 23, 25, '#fffdf0'); ellipse(g, 3 + Math.sin(t) * 4, 0, 10, 13, '#5d55a7'); ellipse(g, 4, 0, 5, 8, INK); ellipse(g, 0, -7, 4, 4, '#fff');
    } else for (const side of [-1, 1]) { ellipse(g, side * 10, -9, 8, 10, '#fffdf0'); ellipse(g, side * 10 + 1, -7, 3, 5, INK); }
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(0, kind === 'cyclops' ? 24 : 12, 8, 0, Math.PI); g.stroke();
    g.restore(); return;
  }
  if (kind === 'jelly') {
    for (let i = 0; i < 5; i++) {
      const dx = -31 + i * 15;
      g.beginPath(); g.moveTo(dx, 12); g.bezierCurveTo(dx - 12, 34, dx + Math.sin(t * 3 + i) * 13, 43, dx + 4, 51);
      g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = color; g.lineWidth = 6; g.stroke();
    }
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-43, 14); g.bezierCurveTo(-49, -56, 45, -61, 43, 14); g.quadraticCurveTo(27, 27, 13, 15); g.quadraticCurveTo(0, 28, -14, 15); g.quadraticCurveTo(-29, 28, -43, 14); g.fillStyle = color; g.fill(); g.stroke();
    ellipse(g, -22, -26, 9, 6, '#e4ffbf'); ellipse(g, 28, 3, 5, 3, '#72db82');
  } else {
    g.fillStyle = '#ffe3a7'; g.strokeStyle = INK; g.lineWidth = 3;
    for (const side of [-1, 1]) {
      g.beginPath(); g.moveTo(side * 22, -23); g.lineTo(side * 42, -50); g.lineTo(side * 41, -5); g.closePath(); g.fill(); g.stroke();
      ellipse(g, side * 30, 37, 18, 10, INK); ellipse(g, side * 30, 34, 15, 9, color);
      g.beginPath(); g.moveTo(side * 39, 7); g.lineTo(side * 55, startled ? -10 : 16); g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = color; g.lineWidth = 6; g.stroke();
    }
    g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-43, 13); g.bezierCurveTo(-58, -47, 52, -51, 44, 12); g.quadraticCurveTo(38, 48, 0, 39); g.quadraticCurveTo(-36, 48, -43, 13); g.fill(); g.stroke();
    ellipse(g, 0, 17, 25, startled ? 17 : 11, INK);
    g.fillStyle = '#fff9e8';
    for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(dx - 5, 8); g.lineTo(dx + 5, 8); g.lineTo(dx, 20); g.fill(); }
  }
  const blink = Math.sin(t * 1.1) > .994 && !startled;
  for (const side of [-1, 1]) {
    ellipse(g, side * 16, -11, 13, blink ? 2 : 15, '#fffef4');
    if (!blink) { ellipse(g, side * 16 + Math.sin(t * .8) * 3, -9, 5, startled ? 9 : 7, INK); ellipse(g, side * 16 - 1, -13, 2, 2, '#fffef4'); }
  }
  if (kind === 'jelly') { g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 4, 6, 0, Math.PI); g.stroke(); }
  g.restore();
}

export function drawPlanet(g, star, x, y, radius, time) {
  const seed = [...star.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  g.save(); g.translate(x, y);
  const halo = g.createRadialGradient(0, 0, radius * .7, 0, 0, radius * 2.3);
  halo.addColorStop(0, star.color + '36'); halo.addColorStop(1, star.color + '00');
  ellipse(g, 0, 0, radius * 2.3, radius * 2.3, halo);
  const ringed = ['lyra', 'glacier', 'nyx', 'rift'].includes(star.id);
  if (ringed) { g.save(); g.rotate(-.35); g.strokeStyle = star.color + '70'; g.lineWidth = radius * .18; g.beginPath(); g.ellipse(0, 0, radius * 1.65, radius * .4, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
  const gradient = g.createRadialGradient(-radius * .4, -radius * .5, 0, radius * .3, radius * .3, radius * 1.5);
  gradient.addColorStop(0, '#fff1d1'); gradient.addColorStop(.4, star.color); gradient.addColorStop(1, '#302447');
  ellipse(g, 0, 0, radius, radius, gradient);
  g.save(); g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.clip();
  g.rotate(Math.sin(time / 24000 + seed) * .12);
  if (['kepler', 'moss', 'nova', 'aurora', 'borealis'].includes(star.id)) {
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(seed + i * 2) * radius * .7, py = Math.cos(seed + i * 1.8) * radius * .8;
      g.fillStyle = i % 2 ? '#174e7770' : '#fff5d95e';
      g.beginPath(); g.moveTo(px - radius * .3, py); g.bezierCurveTo(px - radius * .4, py - radius * .3, px + radius * .5, py - radius * .3, px + radius * .3, py + radius * .2); g.quadraticCurveTo(px, py + radius * .5, px - radius * .3, py); g.fill();
    }
  } else if (['cinder', 'vulcan', 'ember', 'rift'].includes(star.id)) {
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const px = Math.sin(seed + i * 5) * radius; g.strokeStyle = '#442348'; g.lineWidth = radius * .15; g.beginPath(); g.moveTo(px, -radius); g.lineTo(px - radius * .3, -radius * .2); g.lineTo(px + radius * .2, radius * .2); g.lineTo(px - radius * .1, radius); g.stroke(); g.strokeStyle = '#ffe9aa'; g.lineWidth = radius * .045; g.stroke(); }
  } else {
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(seed + i * 3) * radius * .7, py = Math.cos(seed + i * 2) * radius * .7, r = radius * (.08 + i * .03);
      ellipse(g, px, py, r, r * .7, '#45345755'); ellipse(g, px - r * .2, py - r * .2, r * .7, r * .45, '#fff7dc38');
    }
    g.strokeStyle = '#fff8d428'; g.lineWidth = radius * .13;
    for (let i = -1; i < 2; i++) { g.beginPath(); g.ellipse(-radius * .2, i * radius * .5, radius * 1.4, radius * .26, -.3, 0, Math.PI * 2); g.stroke(); }
  }
  const shade = g.createLinearGradient(-radius, -radius, radius, radius);
  shade.addColorStop(0, '#00000000'); shade.addColorStop(.5, '#15112400'); shade.addColorStop(1, '#151124aa');
  ellipse(g, 0, 0, radius, radius, shade); g.restore();
  g.strokeStyle = '#17152d'; g.lineWidth = Math.max(1.5, radius * .07); g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#fff6df88'; g.lineWidth = radius * .065; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, radius * .91, Math.PI * 1.08, Math.PI * 1.52); g.stroke();
  if (ringed) { g.save(); g.rotate(-.35); g.strokeStyle = star.color; g.lineWidth = radius * .1; g.beginPath(); g.ellipse(0, 0, radius * 1.65, radius * .4, 0, 0, Math.PI); g.stroke(); g.restore(); }
  g.restore();
}

export const shipHeading = (dx, dy) => Math.atan2(dy, dx) + Math.PI / 2;

export function drawShip(g, x, y, time, moving, heading = 0) {
  g.save(); g.translate(x, y); g.rotate(heading);
  g.lineWidth = 2; g.strokeStyle = INK; g.lineJoin = 'round';
  if (moving) {
    const flame = 18 + Math.sin(time / 50) * 7;
    g.fillStyle = '#ff9f57'; g.beginPath(); g.moveTo(-7, 11); g.quadraticCurveTo(-12, 22, 0, 17 + flame); g.quadraticCurveTo(12, 22, 7, 11); g.fill();
    g.fillStyle = '#fff4b0'; g.beginPath(); g.moveTo(-3, 13); g.lineTo(0, 24 + flame * .3); g.lineTo(3, 13); g.fill();
  }
  g.fillStyle = '#bba3ff'; g.beginPath(); g.moveTo(-8, -1); g.lineTo(-20, 14); g.lineTo(-18, 23); g.lineTo(-6, 12); g.lineTo(6, 12); g.lineTo(18, 23); g.lineTo(20, 14); g.lineTo(8, -1); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff1da'; g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(-15, -10, -12, 11, -7, 17); g.lineTo(7, 17); g.bezierCurveTo(12, 11, 15, -10, 0, -24); g.fill(); g.stroke();
  g.fillStyle = '#ff9ac8'; g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(-6, -19, -9, -11); g.lineTo(9, -11); g.quadraticCurveTo(6, -19, 0, -24); g.fill(); g.stroke();
  ellipse(g, 0, -1, 6, 8, '#99e6df'); ellipse(g, -1, -3, 2, 3, '#fff9e8');
  g.fillStyle = '#a4d66e'; g.fillRect(-6, 13, 12, 4); g.restore();
}

const spaceStars = Array.from({ length: 180 }, (_, i) => ({ x: ((i * 137.508) % 997) / 997, y: ((i * 83.17 + 31) % 991) / 991, r: i % 13 === 0 ? 1.8 : .65 }));
let backdrop;
export function drawBackdrop(g, width, height, time, camera) {
  if (!backdrop || backdrop.width !== Math.ceil(width) || backdrop.height !== Math.ceil(height)) {
    backdrop = document.createElement('canvas'); backdrop.width = Math.ceil(width); backdrop.height = Math.ceil(height);
    const b = backdrop.getContext('2d'); b.fillStyle = '#101125'; b.fillRect(0, 0, width, height);
    for (const [x, y, color] of [[.68, .28, '#7747bc'], [.28, .68, '#285c85'], [.89, .8, '#8a376d']]) {
      b.save(); b.translate(width * x, height * y); b.scale(1.7, .7);
      const fog = b.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height) * .5);
      fog.addColorStop(0, color + '66'); fog.addColorStop(.4, color + '25'); fog.addColorStop(1, color + '00');
      b.fillStyle = fog; b.fillRect(-width, -height * 2, width * 2, height * 4); b.restore();
    }
    for (let i = 0; i < 550; i++) { const x = ((i * 73.7) % 997) / 997 * width, y = height * (.5 + Math.sin(x / width * 5 + i) * .13 + Math.cos(i * 3) * .16); b.fillStyle = i % 3 ? '#bba3ff0a' : '#fff4d414'; b.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1); }
  }
  g.drawImage(backdrop, 0, 0);
  for (const star of spaceStars) {
    const x = ((star.x * width - camera.x * 2) % width + width) % width, y = ((star.y * height - camera.y * 2) % height + height) % height;
    g.globalAlpha = .25 + (Math.sin(time / 2000 + star.x * 40) + 1) * .24;
    g.fillStyle = star.r > 1 ? '#f7e5ff' : '#94b0d5';
    g.beginPath(); g.arc(x, y, star.r, 0, Math.PI * 2); g.fill();
    if (star.r > 1) { g.fillRect(x - 4, y - .5, 8, 1); g.fillRect(x - .5, y - 4, 1, 8); }
  }
  g.globalAlpha = 1;
  if (time > 0) {
    const t = (time % 11000) / 11000;
    if (t < .14) { const x = width * (1.1 - t * 5), y = height * (.1 + t * 2); const tail = g.createLinearGradient(x, y, x + 95, y - 30); tail.addColorStop(0, '#d9faffaa'); tail.addColorStop(1, '#d9faff00'); g.strokeStyle = tail; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 95, y - 30); g.stroke(); }
  }
}

export function journeyFrame(age) {
  const t = Math.max(0, Math.min(1, age / 1500));
  return { progress: t * t * (3 - 2 * t), phase: t < .27 ? 'departure' : t < .68 ? 'warp' : 'arrival', t };
}

export const journeyHeading = (from, to, progress) => shipHeading(to.x - from.x, to.y - from.y - Math.cos(progress * Math.PI) * 220);

export function drawJourney(g, from, to, width, height, age, reduced = false, shipContext = g) {
  const { progress, phase, t } = journeyFrame(age);
  if (!reduced && phase === 'warp') {
    const strength = Math.sin((t - .27) / .41 * Math.PI);
    g.fillStyle = '#121127'; g.globalAlpha = strength * .65; g.fillRect(0, 0, width, height); g.globalAlpha = 1;
    g.save(); g.translate(width / 2, height / 2);
    for (let i = 0; i < 65; i++) { const angle = i * 2.399, r = 25 + (i * 17 + age * .6) % (width * .6); g.strokeStyle = i % 3 ? '#bda4ff' : '#d7ff63'; g.globalAlpha = strength * (.2 + i % 4 * .14); g.lineWidth = i % 9 === 0 ? 3 : 1; g.beginPath(); g.moveTo(Math.cos(angle) * r, Math.sin(angle) * r * .65); g.lineTo(Math.cos(angle) * (r + 25 + strength * 85), Math.sin(angle) * (r + 25 + strength * 85) * .65); g.stroke(); }
    g.restore(); g.globalAlpha = 1;
  }
  const point = phase === 'arrival' ? to : from;
  g.save(); g.strokeStyle = phase === 'arrival' ? '#d7ff63' : '#bba3ff';
  for (let i = 0; i < 3; i++) { const pulse = reduced ? .5 : ((t * 2 + i * .25) % 1); g.globalAlpha = (1 - pulse) * .65; g.lineWidth = 2; g.beginPath(); g.ellipse(point.x, point.y, 22 + pulse * 90, 10 + pulse * 38, -.2, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  const x = from.x + (to.x - from.x) * progress, y = from.y + (to.y - from.y) * progress - (reduced ? 0 : Math.sin(progress * Math.PI) * 70);
  const heading = reduced ? 0 : journeyHeading(from, to, progress);
  shipContext.save();
  shipContext.translate(reduced ? to.x : x, (reduced ? to.y : y) - 35);
  shipContext.scale(1.35, 1.35);
  drawShip(shipContext, 0, 0, reduced ? 0 : age, !reduced && phase !== 'arrival', heading);
  shipContext.restore();
}

export function drawConfetti(g, origin, age, count = 80) {
  const t = age / 1000;
  if (t < 0 || t > 2.6) return;
  g.save();
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399, speed = 70 + i % 9 * 20;
    const x = origin.x + Math.cos(angle) * speed * t, y = origin.y + Math.sin(angle) * speed * t - 160 * t + 115 * t * t;
    g.save(); g.translate(x, y); g.rotate(angle + t * (i % 2 ? 5 : -5)); g.globalAlpha = Math.min(1, (2.6 - t) * 1.5);
    g.fillStyle = ['#d7ff63', '#ff9ac8', '#bba3ff', '#99e6df', '#ffcf7f'][i % 5];
    if (i % 3) g.fillRect(-3, -2, 7, 4); else { g.beginPath(); g.moveTo(0, -5); g.lineTo(2, -2); g.lineTo(5, 0); g.lineTo(2, 2); g.lineTo(0, 5); g.lineTo(-2, 2); g.lineTo(-5, 0); g.lineTo(-2, -2); g.closePath(); g.fill(); }
    g.restore();
  }
  g.restore();
}

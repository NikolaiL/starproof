const INK = '#17152d';
function ellipse(g, x, y, rx, ry, color) {
  g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

export function drawMonster(g, kind, x, y, size, time, startled = false) {
  const t = time / 1000;
  g.save(); g.translate(x, y + Math.sin(t * 2.6) * size * .07); g.rotate(Math.sin(t * 1.8) * (startled ? .18 : .04)); g.scale(size / 50, size / 50);
  const color = kind === 'jelly' ? '#adff7f' : '#ff9cc8';
  g.lineWidth = 3; g.strokeStyle = INK; g.lineCap = 'round';
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
  g.save(); g.translate(x, y);
  if (star.id === 'lyra') {
    g.save(); g.rotate(-.4); g.strokeStyle = '#ffb4d578'; g.lineWidth = radius * .22;
    g.beginPath(); g.ellipse(0, 0, radius * 1.65, radius * .4, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  g.shadowColor = star.color; g.shadowBlur = radius * .7;
  const gradient = g.createRadialGradient(-radius * .4, -radius * .45, 0, radius * .2, radius * .2, radius * 1.4);
  gradient.addColorStop(0, '#fff7df'); gradient.addColorStop(.35, star.color); gradient.addColorStop(1, '#28203e');
  ellipse(g, 0, 0, radius, radius, gradient); g.shadowBlur = 0;
  g.save(); g.beginPath(); g.arc(0, 0, radius - 1, 0, Math.PI * 2); g.clip();
  g.rotate(time / 60_000);
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = .25; ellipse(g, Math.sin(i * 2.3) * radius * .75, Math.cos(i * 4.3) * radius * .7, radius * (.28 + i * .03), radius * .12, star.id === 'vega' ? '#6938bd' : '#fffde7');
  }
  g.restore(); g.strokeStyle = '#e5d9ff6b'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.stroke(); g.restore();
}

export function drawShip(g, x, y, time, moving) {
  g.save(); g.translate(x, y);
  if (moving) {
    const flame = 12 + Math.sin(time / 65) * 5;
    g.fillStyle = '#ff9f57'; g.beginPath(); g.moveTo(-6, 10); g.lineTo(0, 10 + flame); g.lineTo(6, 10); g.fill();
    g.fillStyle = '#fff5ba'; g.beginPath(); g.moveTo(-3, 10); g.lineTo(0, 16 + flame / 2); g.lineTo(3, 10); g.fill();
  }
  g.fillStyle = '#dfff62'; g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -19); g.lineTo(13, 12); g.lineTo(0, 6); g.lineTo(-13, 12); g.closePath(); g.fill(); g.stroke();
  ellipse(g, 0, -4, 4, 6, '#9e8eff'); g.restore();
}

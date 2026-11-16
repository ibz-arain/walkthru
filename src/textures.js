
// =====================================================================
//  MORE SURFACES for the finish types: siding, roofing, tile, stone, wood patterns. Drawn in greys so the
//  chosen colour tints them (world UVs are in feet, like the rest of TX).
// =====================================================================
Object.assign(TX, {
  lap: ctex(256, 4, (g, s, r) => { noise(g, s, r, 226, 14, 5000, 2); const n = 8, h = s / n; // 6" boards
    for (let i = 0; i < n; i++) { const y = i * h; g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(0, y + h - 3, s, 3); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y, s, 2); } }, 51),
  panel: ctex(256, 4, (g, s, r) => { noise(g, s, r, 222, 18, 5000, 2); const n = 6, w = s / n;
    for (let i = 0; i < n; i++) { const x = i * w; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + w - 2, 0, 2, s);
      for (let k = 0; k < 10; k++) { g.strokeStyle = `rgba(0,0,0,${.05 + r() * .06})`; g.beginPath(); const gx = x + r() * w; g.moveTo(gx, 0); g.bezierCurveTo(gx + 3, s / 3, gx - 3, 2 * s / 3, gx, s); g.stroke(); } } }, 53),
  clay: ctex(256, 3, (g, s, r) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); const rows = 8, rh = s / rows, cw = s / 6;
    for (let i = 0; i < rows; i++) for (let j = -1; j < 7; j++) { const x = j * cw + (i % 2) * cw / 2, y = i * rh, v = 185 + r() * 50 | 0;
      const gr = g.createLinearGradient(x, 0, x + cw, 0); gr.addColorStop(0, `rgb(${v - 40},${v - 40},${v - 40})`); gr.addColorStop(.5, `rgb(${v},${v},${v})`); gr.addColorStop(1, `rgb(${v - 40},${v - 40},${v - 40})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + cw, y); g.lineTo(x + cw, y + rh - 2); g.quadraticCurveTo(x + cw / 2, y + rh + 4, x, y + rh - 2); g.fill(); } }, 57),
  slate: ctex(512, 6, (g, s, r) => { g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, s, s); let y = 0;
    while (y < s) { const h = 40 + r() * 70 | 0; let x = -r() * 120; while (x < s) { const w = 70 + r() * 150, v = 150 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 3, y + 3, w - 5, h - 5);
      for (let k = 0; k < 60; k++) { const q = v + (r() - .5) * 30 | 0; g.fillStyle = `rgba(${q},${q},${q},.6)`; g.fillRect(x + r() * w, y + r() * h, 3, 2); } x += w; } y += h; } }, 59),
  field: ctex(512, 6, (g, s, r) => { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { const x = r() * s, y = r() * s, rx = 22 + r() * 34, ry = 14 + r() * 22, v = 160 + r() * 80 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, r() * 3, 0, 7); g.fill(); } } }, 61),
  marble: ctex(512, 4, (g, s, r) => { noise(g, s, r, 240, 8, 6000, 3);
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(110,110,110,${.12 + r() * .25})`; g.lineWidth = .6 + r() * 2.2; g.beginPath(); let x = r() * s, y = 0; g.moveTo(x, y);
      while (y < s) { const nx = x + (r() - .5) * 90, ny = y + 30 + r() * 60; g.quadraticCurveTo(x + (r() - .5) * 60, (y + ny) / 2, nx, ny); x = nx; y = ny; } g.stroke(); } }, 63),
  terrazzo: ctex(256, 2, (g, s, r) => { noise(g, s, r, 210, 22, 3000, 2);
    for (let i = 0; i < 900; i++) { const v = r() < .5 ? 60 + r() * 60 | 0 : 230 + r() * 25 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(r() * s, r() * s, .6 + r() * 2.4, 0, 7); g.fill(); } }, 65),
  herring: ctex(512, 4, (g, s, r) => { g.fillStyle = '#888'; g.fillRect(0, 0, s, s); const L = s / 4, W = s / 16; // planks 1' × 3"
    for (let row = -2; row < 18; row++) for (let col = -2; col < 6; col++) for (const flip of [0, 1]) {
      const x = col * L + row * W - (flip ? 0 : W), y = row * W + col * 0, v = 170 + r() * 60 | 0;
      g.save(); g.translate(x + (flip ? L : 0), y); g.rotate(flip ? Math.PI / 2 : 0); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(1, 1, L - 2, W - 2); g.restore(); } }, 67),
  subway: ctex(256, 2, (g, s, r) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); const rows = 8, rh = s / rows, bw = s / 4; // 3" × 6"
    for (let i = 0; i < rows; i++) for (let j = -1; j < 5; j++) { const v = 228 + r() * 20 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(j * bw + (i % 2) * bw / 2 + 1.5, i * rh + 1.5, bw - 3, rh - 3); } }, 69),
  mosaic: ctex(256, 1, (g, s, r) => { g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, s, s); const n = 8, c = s / n; // 1½" squares
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 190 + r() * 60 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(j * c + 1.5, i * c + 1.5, c - 3, c - 3); } }, 71),
  bigtile: ctex(256, 8, (g, s, r) => { noise(g, s, r, 232, 10, 4000, 2); g.fillStyle = 'rgba(0,0,0,.2)'; // 4' × 4' slabs... drawn as 2' × 4'
    g.fillRect(0, 0, s, 2); g.fillRect(0, s / 2, s, 2); g.fillRect(0, 0, 2, s); }, 73),
});
// composite / painted deck boards (grey, so any colour works)
TX.boards = ctex(256, 4, (g, s, r) => { g.fillStyle = '#555'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { const v = 200 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, i * s / 8, s, s / 8 - 3);
  for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, i * s / 8 + r() * (s / 8 - 4), s, 1); } } }, 75);

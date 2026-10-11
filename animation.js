// The Very Hungry Black Hole
// A 2D doodle-style canvas animation of a black hole swallowing the Earth.
// Everything is drawn with "wobbly" strokes that are re-jittered a few times a
// second (line boil) to give a hand-drawn, flip-book feel.
(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');

  const TAU = Math.PI * 2;
  const LOOP = 18;                 // seconds per full story
  const BOIL_FPS = 8;              // how often the line wobble changes
  const INK = '#2b2b2b';
  const PAPER = '#fbf7ec';
  const FONT = '"Gloria Hallelujah", "Comic Sans MS", "Chalkboard SE", cursive';

  let W = 0, H = 0, S = 1, CX = 0, CY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W, H) / 800;
    CX = W / 2;
    CY = H / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- small maths helpers ----------
  const hash = (a, b = 0, c = 0) => {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const bump = (t, c, w) => {
    const d = (t - c) / w;
    return Math.abs(d) < 1 ? 0.5 + 0.5 * Math.cos(d * Math.PI) : 0;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let boil = 0;
  // Jitter that stays still between boil frames
  const jit = (id, i, amp) => (hash(id, i, boil) - 0.5) * 2 * amp;

  // ---------- sketchy drawing primitives ----------
  function curveThrough(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }

  // Static lumpiness as a smooth function of angle, so fill and outline agree
  function lump(id, a, amount) {
    if (!amount) return 0;
    return amount * (
      0.5 * Math.sin(2 * a + hash(id, 1) * TAU) +
      0.35 * Math.sin(3 * a + hash(id, 2) * TAU) +
      0.2 * Math.sin(5 * a + hash(id, 3) * TAU)
    );
  }

  function ellipsePts(cx, cy, rx, ry, id, a0, span, wob, n, shape = 0, shapeId = id) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * i / n;
      const k = 1 + lump(shapeId, a, shape) + jit(id, i, wob);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  function sketchEllipse(cx, cy, rx, ry, id, o = {}) {
    const {
      stroke = INK, width = 3 * S, fill = null, passes = 2, wob = 0.04, shape = 0,
    } = o;
    const n = clamp(Math.round(Math.max(rx, ry) / (5 * S)), 14, 60);
    if (fill) {
      ctx.beginPath();
      curveThrough(ellipsePts(cx, cy, rx, ry, id + 0.5, 0, TAU, wob * 0.5, n, shape, id));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (!stroke) return;
    ctx.strokeStyle = stroke;
    let w = width;
    for (let p = 0; p < passes; p++) {
      // Start somewhere random and overshoot a little, like a real pen circle
      const a0 = hash(id, p + 7, boil) * TAU;
      const span = TAU + 0.15 + hash(id, p + 9, boil) * 0.35;
      ctx.lineWidth = w;
      ctx.beginPath();
      curveThrough(ellipsePts(cx, cy, rx, ry, id + p * 13, a0, span, wob, n + 3, shape, id));
      ctx.stroke();
      w *= 0.5;
    }
  }

  const sketchCircle = (cx, cy, r, id, o) => sketchEllipse(cx, cy, r, r, id, o);

  function sketchLine(x1, y1, x2, y2, id, amp = 2 * S) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const pts = [];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const off = (i === 0 || i === n) ? jit(id, i, amp * 0.5) : jit(id, i, amp);
      pts.push([x1 + dx * u + nx * off, y1 + dy * u + ny * off]);
    }
    ctx.beginPath();
    curveThrough(pts);
    ctx.stroke();
  }

  // Pencil hatching over a square of half size R (caller sets the clip)
  function hatch(R, id, color, spacing, angle, width) {
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let i = 0;
    for (let y = -R; y <= R; y += spacing, i++) {
      ctx.moveTo(-R + jit(id, i, 3 * S), y + jit(id, i + 40, 1.5 * S));
      ctx.lineTo(R + jit(id, i + 80, 3 * S), y + jit(id, i + 120, 1.5 * S) + spacing * 0.35);
    }
    ctx.stroke();
    ctx.restore();
  }

  function wobblyText(text, x, y, size, id, o = {}) {
    const { fill = INK, stroke = null, strokeWidth = 3 * S, align = 'center', rot = 0 } = o;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot + jit(id, 1, 0.025));
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeText(text, 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function speechBubble(text, tx, ty, id, size) {
    ctx.font = `${size}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const rx = tw / 2 + 22 * S, ry = size * 0.95;
    const x = clamp(tx + 70 * S, rx + 12, W - rx - 12);
    const y = clamp(ty - 95 * S, ry + 12, H - ry - 12);

    // tail pointing at the speaker
    const ang = Math.atan2(ty - y, tx - x);
    const bx = x + Math.cos(ang) * rx * 0.7, by = y + Math.sin(ang) * ry * 0.7;
    const px = -Math.sin(ang) * 12 * S, py = Math.cos(ang) * 12 * S;
    const ex = lerp(x, tx, 0.72), ey = lerp(y, ty, 0.72);
    ctx.beginPath();
    ctx.moveTo(bx + px, by + py);
    ctx.lineTo(ex + jit(id, 3, 2 * S), ey + jit(id, 4, 2 * S));
    ctx.lineTo(bx - px, by - py);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5 * S;
    ctx.stroke();

    sketchEllipse(x, y, rx, ry, id, { fill: '#fff', width: 2.5 * S });
    wobblyText(text, x, y, size, id + 1);
  }

  // ---------- scene pieces ----------
  function drawPaper() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(90, 140, 200, 0.2)';
    ctx.beginPath();
    for (let y = 64; y < H; y += 28) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220, 80, 80, 0.35)';
    ctx.beginPath();
    ctx.moveTo(56, 0); ctx.lineTo(56, H);
    ctx.stroke();
  }

  function drawStars(t, pull) {
    ctx.strokeStyle = INK;
    for (let i = 0; i < 48; i++) {
      let x = hash(i, 1) * W, y = hash(i, 2) * H;
      const d = Math.hypot(x - CX, y - CY);
      // keep clear of the hole, the title and the narration line
      if (d < 150 * S || y < 80 || y > H - Math.max(70, 95 * S)) continue;
      // nearby stars lean in towards the hole when it gulps
      const k = pull * clamp(1 - d / (500 * S), 0, 1) * 0.25;
      x = lerp(x, CX, k); y = lerp(y, CY, k);
      const tw = 0.7 + 0.3 * Math.sin(t * 2.3 + i * 1.7);
      const s = (4 + hash(i, 3) * 6) * S * tw;
      const arms = hash(i, 4) < 0.5 ? 2 : 3;
      ctx.lineWidth = 1.8 * S;
      ctx.beginPath();
      for (let a = 0; a < arms; a++) {
        const ang = a * Math.PI / arms + hash(i, 5) * 0.6;
        const dx = Math.cos(ang) * s, dy = Math.sin(ang) * s;
        ctx.moveTo(x - dx + jit(i, a, 1), y - dy + jit(i, a + 5, 1));
        ctx.lineTo(x + dx + jit(i, a + 9, 1), y + dy + jit(i, a + 13, 1));
      }
      ctx.stroke();
    }
  }

  function drawSwirl(t, bh) {
    ctx.strokeStyle = 'rgba(43, 43, 43, 0.22)';
    ctx.lineWidth = 1.6 * S;
    for (let k = 0; k < 4; k++) {
      const pts = [];
      const base = t * 0.7 + k * TAU / 4;
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const r = bh * 1.4 + u * bh * 3.4;
        const a = base - u * 3.6;
        pts.push([CX + Math.cos(a) * r + jit(k, i, 1.5 * S), CY + Math.sin(a) * r * 0.85 + jit(k, i + 50, 1.5 * S)]);
      }
      ctx.beginPath();
      curveThrough(pts);
      ctx.stroke();
    }
  }

  const DISC = [
    { k: 1.35, col: '#e8483b', w: 5 },
    { k: 1.6, col: '#ff8a3d', w: 7 },
    { k: 1.88, col: '#ffc93c', w: 6 },
    { k: 2.2, col: '#ff8a3d', w: 3.5 },
  ];
  const TILT = -0.22;
  const FLAT = 0.32;

  function drawDisc(t, bh, front) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(TILT);
    const a0 = front ? 0 : Math.PI;
    ctx.lineCap = 'round';
    DISC.forEach((d, i) => {
      const rx = bh * d.k, ry = rx * FLAT;
      ctx.strokeStyle = d.col;
      ctx.lineWidth = d.w * S;
      ctx.setLineDash([24 * S, (10 + i * 5) * S]);
      ctx.lineDashOffset = -t * 140 * S * (1.4 - i * 0.2);
      ctx.beginPath();
      curveThrough(ellipsePts(0, 0, rx, ry, 300 + i + (front ? 0 : 10), a0, Math.PI, 0.025, 30));
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // ink edges
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * S;
    [1.22, 2.38].forEach((k, i) => {
      ctx.beginPath();
      curveThrough(ellipsePts(0, 0, bh * k, bh * k * FLAT, 320 + i + (front ? 0 : 10), a0, Math.PI, 0.03, 30));
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawHole(t, bh, look) {
    // lensed glow ring
    sketchCircle(CX, CY, bh * 1.16, 900, { stroke: '#ffc93c', width: 5 * S });
    sketchCircle(CX, CY, bh, 901, { fill: '#151515', width: 4 * S });
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, bh * 0.94, 0, TAU);
    ctx.clip();
    ctx.translate(CX, CY);
    hatch(bh, 902, 'rgba(255, 255, 255, 0.07)', 7 * S, 0.6, 1.4 * S);
    ctx.restore();

    // a cheeky face
    const eyeY = CY - bh * 0.38, eyeDX = bh * 0.34, eyeR = bh * 0.17;
    const happy = t > 10.5 && t < 16.5;
    const gape = bump(t, 9.95, 0.6);
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const ex = CX + s * eyeDX;
      if (happy) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.5 * S;
        ctx.beginPath();
        ctx.arc(ex, eyeY + eyeR * 0.5, eyeR, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        sketchCircle(ex, eyeY, eyeR * (1 + gape * 0.4), 910 + s, { fill: '#fff', stroke: '#fff', width: 2 * S, passes: 1 });
        const lx = look[0] * eyeR * 0.45, ly = look[1] * eyeR * 0.45;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex + lx, eyeY + ly, eyeR * 0.45, 0, TAU);
        ctx.fill();
        // villainous eyebrows
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.5 * S;
        const by = eyeY - eyeR * 1.6 - gape * 6 * S;
        sketchLine(ex - s * eyeR * 1.2, by - eyeR * 0.5, ex + s * eyeR * 0.4, by + eyeR * 0.35, 920 + s, 1.5 * S);
      }
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3.5 * S;
    const my = CY - bh * 0.02;
    if (gape > 0.05) {
      sketchEllipse(CX, my, bh * 0.3 * gape + 2, bh * 0.22 * gape + 2, 930, { fill: '#000', stroke: '#fff', width: 3 * S });
    } else if (t > 12.1 && t < 13.2) {
      sketchCircle(CX, my, bh * 0.08, 931, { stroke: '#fff', width: 3 * S, passes: 1 });
    } else {
      // grin (bigger and greedier as the Earth approaches)
      const g = happy ? 0.8 : 1;
      ctx.beginPath();
      ctx.arc(CX, my - bh * 0.2, bh * 0.32 * g, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      if (!happy && t > 2.5 && t < 9.4) {
        // drooling tongue
        const dl = (0.5 + 0.5 * Math.sin(t * 3)) * bh * 0.1;
        ctx.fillStyle = '#ff7aa2';
        ctx.beginPath();
        ctx.ellipse(CX + bh * 0.15, my + bh * 0.12 + dl * 0.5, bh * 0.07, bh * 0.06 + dl * 0.5, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // [longitude, latitude, size]
  const CONTINENTS = [
    [0.1, -0.35, 0.55], [-1.0, 0.3, 0.6], [1.6, 0.2, 0.6],
    [2.8, -0.45, 0.45], [4.1, 0.4, 0.5], [0.6, 0.75, 0.3],
  ];

  function drawEarth(e, t) {
    const { x, y, R, dir, stretch, fear, spin } = e;
    if (R < 0.6) return;
    ctx.save();
    ctx.translate(x, y);
    // spaghettify along the line to the black hole, keeping the face upright
    ctx.rotate(dir);
    ctx.scale(stretch, 1 / stretch);
    ctx.rotate(-dir);

    sketchCircle(0, 0, R, 100, { fill: '#7cc6ee', stroke: null });
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.97, 0, TAU);
    ctx.clip();
    hatch(R, 101, 'rgba(30, 100, 170, 0.35)', 6 * S, -0.7, 1.3 * S);
    CONTINENTS.forEach((c, i) => {
      const lon = c[0] + spin;
      const cz = Math.cos(lon);
      if (cz < -0.15) return;
      const cx = Math.sin(lon) * Math.cos(c[1]) * R;
      const cy = Math.sin(c[1]) * R;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(0.2, cz), 1);
      sketchCircle(0, 0, c[2] * R * 0.55, 120 + i, { fill: '#79c24f', stroke: '#2f6b1f', width: 2 * S, passes: 1, shape: 0.35, wob: 0.03 });
      ctx.restore();
    });
    // polar cap
    sketchEllipse(0, -R * 0.95, R * 0.45, R * 0.18, 140, { fill: '#ffffff', stroke: null });
    ctx.restore();
    sketchCircle(0, 0, R, 102, { width: 3.2 * S });

    // face
    const look = [Math.cos(dir), Math.sin(dir)];
    const eyeR = R * (0.17 + 0.07 * fear);
    for (let s = -1; s <= 1; s += 2) {
      const ex = s * R * 0.3, ey = -R * 0.12;
      sketchCircle(ex, ey, eyeR, 150 + s, { fill: '#fff', width: 2 * S, passes: 1 });
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + look[0] * eyeR * 0.45, ey + look[1] * eyeR * 0.45, eyeR * (0.45 - 0.15 * fear), 0, TAU);
      ctx.fill();
      if (fear > 0.2) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5 * S;
        const by = ey - eyeR * 1.5;
        sketchLine(ex - s * eyeR * 0.1, by - eyeR * 0.4 * fear, ex + s * eyeR, by + eyeR * 0.3 * fear, 160 + s, 1 * S);
      }
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5 * S;
    if (fear < 0.25) {
      ctx.beginPath();
      ctx.arc(0, R * 0.12, R * 0.28, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else {
      const mr = R * (0.06 + 0.12 * fear);
      sketchEllipse(0, R * 0.42, mr * 0.8, mr, 170, { fill: '#5a1f1f', width: 2.2 * S, passes: 1 });
    }
    if (fear > 0.45) {
      // sweat drop
      const sx = R * 0.62, sy = -R * 0.45 + ((t * 40 * S) % (R * 0.5));
      ctx.fillStyle = '#9fdcff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8 * S;
      ctx.beginPath();
      ctx.moveTo(sx, sy - R * 0.16);
      ctx.quadraticCurveTo(sx + R * 0.1, sy, sx, sy + R * 0.06);
      ctx.quadraticCurveTo(sx - R * 0.1, sy, sx, sy - R * 0.16);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpeedLines(e, prev) {
    const vx = e.x - prev.x, vy = e.y - prev.y;
    const v = Math.hypot(vx, vy);
    if (v < 0.5 || e.R < 2) return;
    const ux = vx / v, uy = vy / v, nx = -uy, ny = ux;
    const len = clamp(v * 6, 15 * S, 90 * S);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * S;
    for (let k = -1; k <= 1; k++) {
      const sx = e.x - ux * e.R * 1.35 + nx * k * e.R * 0.55;
      const sy = e.y - uy * e.R * 1.35 + ny * k * e.R * 0.55;
      const l = len * (k === 0 ? 1 : 0.7);
      sketchLine(sx, sy, sx - ux * l, sy - uy * l, 180 + k, 2 * S);
    }
  }

  // ---------- story timeline ----------
  const A0 = -2.45;

  function earthState(t) {
    const p = clamp((t - 2.5) / 7.5, 0, 1);
    const r0 = 300 * S, rEnd = 70 * S * 1.15;
    const r = r0 - (r0 - rEnd) * Math.pow(p, 1.7);
    const a = A0 + 8.5 * Math.pow(p, 2.2);
    const bob = (1 - smooth(0, 0.2, p)) * Math.sin(t * 2.2) * 8 * S;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r + bob;
    return {
      p, x, y,
      R: 55 * S * (1 - smooth(0.68, 1, p)),
      dir: Math.atan2(CY - y, CX - x),
      stretch: 1 + 2.3 * Math.pow(smooth(0.35, 1, p), 1.5),
      fear: smooth(0.02, 0.3, p),
      spin: t * 0.5 + p * p * 5,
    };
  }

  function holeRadius(t) {
    return 70 * S * (1 + 0.2 * bump(t, 10.05, 0.35) + 0.1 * smooth(10, 11, t) + 0.06 * bump(t, 12.6, 0.4));
  }

  const NARRATION = [
    [0.3, 2.6, 'Meet Earth. Lovely planet. Very round.'],
    [2.6, 6.2, 'Meet the black hole. Very hungry.'],
    [6.2, 9.8, 'Spaghettification in progress...'],
    [10.6, 14.4, 'Well, that escalated quickly.'],
    [14.4, 17.6, 'The End.  (click to watch again)'],
  ];

  // ---------- debris ----------
  let debris = [];
  let spawnAcc = 0;
  const ROCK = ['#7cc6ee', '#79c24f', '#b07a4a', '#5aa0d0'];

  function updateDebris(dt, e, bh) {
    if (e.p > 0.55 && e.p < 1 && e.R > 1) {
      spawnAcc += (20 + 240 * smooth(0.55, 1, e.p)) * dt;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * e.R;
        const along = Math.cos(a) * rr * e.stretch, across = Math.sin(a) * rr / e.stretch;
        const px = e.x + Math.cos(e.dir) * along - Math.sin(e.dir) * across;
        const py = e.y + Math.sin(e.dir) * along + Math.cos(e.dir) * across;
        debris.push({
          r: Math.hypot(px - CX, py - CY),
          th: Math.atan2(py - CY, px - CX),
          size: (3 + Math.random() * 7) * S,
          col: pick(ROCK),
          id: Math.random() * 1000,
        });
      }
    }
    for (const d of debris) {
      const rn = d.r / S;
      d.th += (0.8 + 150 / rn) * dt;
      d.r -= (15 + 2600 / rn) * S * dt;
    }
    debris = debris.filter((d) => d.r > bh * 0.75);
  }

  function drawDebris(bh) {
    ctx.lineCap = 'round';
    for (const d of debris) {
      const sc = smooth(bh * 0.8, bh * 1.7, d.r);
      if (sc <= 0.02) continue;
      const x = CX + Math.cos(d.th) * d.r, y = CY + Math.sin(d.th) * d.r;
      ctx.strokeStyle = d.col;
      ctx.lineWidth = d.size * 0.45 * sc;
      ctx.beginPath();
      ctx.arc(CX, CY, d.r * 1.03, d.th - 0.35, d.th - 0.04);
      ctx.stroke();
      sketchCircle(x, y, d.size * sc, d.id, { fill: d.col, width: 1.6 * S, passes: 1, shape: 0.4 });
    }
  }

  // ---------- main loop ----------
  let clock = 0;
  let last = performance.now();
  let paused = false;
  let prevEarth = earthState(0);

  function restart() {
    clock = 0;
    debris = [];
    spawnAcc = 0;
    prevEarth = earthState(0);
  }

  canvas.addEventListener('click', restart);
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') { paused = !paused; ev.preventDefault(); }
    if (ev.key === 'r' || ev.key === 'R') restart();
  });

  function draw(t, e, bh) {
    drawPaper();

    const shake = 6 * S * smooth(0.7, 1, e.p) * (t < 10.2 ? 1 : 0) + 12 * S * bump(t, 10.05, 0.3);
    ctx.save();
    ctx.translate(jit(1, 1, shake), jit(1, 2, shake));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawStars(t, bump(t, 10.05, 0.5));
    drawSwirl(t, bh);
    drawDisc(t, bh, false);
    drawDebris(bh);

    const lookAt = t < 10 ? [Math.cos(e.dir + Math.PI), Math.sin(e.dir + Math.PI)] : [0, 0.3];
    drawHole(t, bh, lookAt);
    drawDisc(t, bh, true);

    if (e.p > 0.12 && e.R > 1) drawSpeedLines(e, prevEarth);
    drawEarth(e, t);

    // impact lines + GULP!
    const g = bump(t, 10.4, 0.9);
    if (g > 0) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3 * S;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + 0.2;
        const r1 = bh * 1.45, r2 = bh * (1.75 + 0.5 * g);
        sketchLine(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1, CX + Math.cos(a) * r2, CY + Math.sin(a) * r2, 500 + i, 2 * S);
      }
      const pop = 1 + 0.25 * bump(t, 9.75, 0.25);
      wobblyText('GULP!', CX + bh * 1.4, CY - bh * 1.9, 92 * S * g * pop, 510, {
        fill: '#ff8a3d', stroke: INK, strokeWidth: 6 * S, rot: -0.15,
      });
    }

    // burp
    if (t > 12.2 && t < 14.6) {
      const u = (t - 12.2) / 2.4;
      const fade = 1 - smooth(0.6, 1, u);
      ctx.globalAlpha = fade;
      for (let i = 0; i < 4; i++) {
        const k = clamp(u * 1.6 - i * 0.12, 0, 1);
        if (k <= 0) continue;
        const px = CX + bh * 0.1 + Math.sin(i * 2.1 + t) * 14 * S;
        const py = CY - bh * 1.05 - k * 140 * S - i * 18 * S;
        sketchCircle(px, py, (10 + i * 7) * S * (0.4 + k), 600 + i, { fill: '#e9e3d3', width: 2 * S, passes: 1, shape: 0.15 });
      }
      wobblyText('*burp*', CX - bh * 1.5, CY - bh * 1.6, 44 * S, 620, { rot: 0.12 });
      ctx.globalAlpha = 1;
    }

    // Earth's last words
    if (t > 3.2 && t < 5.6) speechBubble('uh oh...', e.x, e.y - e.R, 700, Math.max(16, 30 * S));
    if (t > 6.9 && t < 9.2) speechBubble('NOOOOO!', e.x, e.y - e.R / e.stretch, 710, Math.max(18, 36 * S));
    ctx.restore();

    // title + narration (fixed to the page, no shake)
    ctx.save();
    ctx.lineCap = 'round';
    const ts = Math.max(18, 30 * S);
    wobblyText('The Very Hungry Black Hole', 74, 38, ts, 800, { align: 'left', rot: -0.02 });
    ctx.font = `${ts}px ${FONT}`;
    const tw = ctx.measureText('The Very Hungry Black Hole').width;
    ctx.strokeStyle = '#e8483b';
    ctx.lineWidth = 2.5 * S;
    sketchLine(70, 38 + ts * 0.8, 74 + tw, 38 + ts * 0.7, 801, 3 * S);
    ctx.restore();

    for (const [a, b, text] of NARRATION) {
      if (t >= a && t < b) {
        ctx.globalAlpha = smooth(a, a + 0.3, t) * (1 - smooth(b - 0.3, b, t));
        wobblyText(text, CX, H - Math.max(36, 54 * S), Math.max(16, 30 * S), 850 + a, {});
        ctx.globalAlpha = 1;
      }
    }

    // fade in/out at the loop seam
    const fade = 1 - smooth(0, 0.6, t) + smooth(17.2, 18, t);
    if (fade > 0) {
      ctx.globalAlpha = clamp(fade, 0, 1);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      clock += dt;
      if (clock >= LOOP) restart();
    }
    const t = clock;
    boil = Math.floor(t * BOIL_FPS);
    const e = earthState(t);
    const bh = holeRadius(t);
    if (!paused) updateDebris(dt, e, bh);
    draw(t, e, bh);
    prevEarth = e;
    requestAnimationFrame(frame);
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load(`30px "Gloria Hallelujah"`).catch(() => {});
  }
  requestAnimationFrame(frame);
})();

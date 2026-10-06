// Plants are drawn in code from a few parameters, so every growth stage and every
// level of wilting comes from the same drawing. Design space is 100 x 110, soil at the bottom.

const BROWN = '#8a6b42';
const BASE_X = 50;
const BASE_Y = 94;

interface FlowerSpec {
  height: number;
  stemWidth: number;
  stem: string;
  leaf: number;
  leaves: number;
  head(ctx: CanvasRenderingContext2D, k: number): void;
  bud: string;
}

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function petals(ctx: CanvasRenderingContext2D, count: number, dist: number, rx: number, ry: number, colour: string): void {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / count);
    ellipse(ctx, 0, -dist, rx, ry, colour);
    ctx.restore();
  }
}

const FLOWERS: Record<string, FlowerSpec> = {
  daisy: {
    height: 50,
    stemWidth: 2.6,
    stem: '#5aa84f',
    leaf: 13,
    leaves: 3,
    bud: '#dfe9c9',
    head(ctx, k) {
      petals(ctx, 11, 9, 3.2, 6.5, mix('#ffffff', BROWN, k));
      ellipse(ctx, 0, 0, 5.2, 5.2, mix('#f6c33b', BROWN, k));
    },
  },
  tulip: {
    height: 54,
    stemWidth: 3,
    stem: '#4f9d52',
    leaf: 22,
    leaves: 2,
    bud: '#e58aa0',
    head(ctx, k) {
      for (const [angle, colour] of [[-0.38, '#d9486b'], [0.38, '#d9486b'], [0, '#ef6f8c']] as [number, string][]) {
        ctx.save();
        ctx.rotate(angle);
        ellipse(ctx, 0, -8, 6, 11, mix(colour, BROWN, k));
        ctx.restore();
      }
    },
  },
  sunflower: {
    height: 68,
    stemWidth: 3.8,
    stem: '#4c9447',
    leaf: 18,
    leaves: 4,
    bud: '#c9c15a',
    head(ctx, k) {
      petals(ctx, 16, 13, 3.6, 7.5, mix('#f7b500', BROWN, k));
      ellipse(ctx, 0, 0, 9.5, 9.5, mix('#6b4423', '#4a3a2a', k));
      ellipse(ctx, 0, 0, 6, 6, mix('#4e2f17', '#3a2e22', k));
    },
  },
  rose: {
    height: 58,
    stemWidth: 2.8,
    stem: '#3f8347',
    leaf: 12,
    leaves: 4,
    bud: '#c2475c',
    head(ctx, k) {
      ellipse(ctx, 0, -2, 11, 10.5, mix('#b3243f', BROWN, k));
      ellipse(ctx, -2, -3, 8, 7.5, mix('#d43857', BROWN, k));
      ellipse(ctx, 1.5, -2, 5, 4.8, mix('#e9627c', BROWN, k));
      ellipse(ctx, 0.5, -2.5, 2.2, 2.2, mix('#a01f38', BROWN, k));
    },
  },
};

function drawSoil(ctx: CanvasRenderingContext2D, wet: boolean): void {
  ellipse(ctx, BASE_X, BASE_Y + 4, 36, 10, wet ? '#4f331f' : '#7a573a');
  ellipse(ctx, BASE_X, BASE_Y + 2.5, 32, 7.5, wet ? '#5f3f27' : '#94704d');
}

function drawFlower(ctx: CanvasRenderingContext2D, spec: FlowerSpec, t: number, decay: number, dead: boolean): void {
  const grown = 1 - (1 - t) * (1 - t);
  const k = dead ? 1 : decay * 0.75; // how brown
  const bend = dead ? 1 : decay * 0.8; // how droopy
  const height = spec.height * (0.22 + 0.78 * grown) * (dead ? 0.85 : 1);

  // Stem: a curve that leans over as the plant dries out.
  const cx = BASE_X;
  const cy = BASE_Y - height * 0.6;
  const tx = BASE_X + bend * height * 0.55;
  const ty = BASE_Y - height * (1 - bend * 0.5);
  const at = (f: number): [number, number] => [
    (1 - f) * (1 - f) * BASE_X + 2 * (1 - f) * f * cx + f * f * tx,
    (1 - f) * (1 - f) * BASE_Y + 2 * (1 - f) * f * cy + f * f * ty,
  ];

  const leafCount = t < 0.3 ? 1 : t < 0.6 ? 2 : spec.leaves;
  const leafSize = spec.leaf * (0.45 + 0.55 * grown);
  for (let j = 0; j < leafCount; j++) {
    const [x, y] = at(0.2 + j * (0.5 / spec.leaves));
    const side = j % 2 === 0 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * (0.85 + bend * 1.15));
    ellipse(ctx, 0, -leafSize / 2, leafSize * 0.27, leafSize / 2, mix(j % 2 ? '#4e9a4a' : '#63b058', BROWN, k));
    ctx.restore();
  }

  ctx.strokeStyle = mix(spec.stem, BROWN, k);
  ctx.lineWidth = spec.stemWidth * (0.6 + 0.4 * grown);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(BASE_X, BASE_Y);
  ctx.quadraticCurveTo(cx, cy, tx, ty);
  ctx.stroke();

  if (t < 0.55) return;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(bend * 1.9);
  if (t < 1) {
    // Bud that swells as the plant gets close to blooming.
    const size = 0.6 + (t - 0.55) * 1.6;
    ellipse(ctx, 0, -3 * size, 3.6 * size, 5.5 * size, mix(spec.bud, BROWN, k));
    ellipse(ctx, 0, -1.2 * size, 3.4 * size, 3 * size, mix(spec.stem, BROWN, k));
  } else {
    if (dead) ctx.scale(0.8, 0.8);
    spec.head(ctx, k);
  }
  ctx.restore();
}

function drawCactus(ctx: CanvasRenderingContext2D, t: number, decay: number, dead: boolean): void {
  const grown = 1 - (1 - t) * (1 - t);
  const k = dead ? 1 : decay * 0.8;
  const body = dead ? '#8a7a55' : mix('#4f9d5b', '#b9a85a', k);
  const dark = dead ? '#6e6145' : mix('#3b7d47', '#958546', k);
  const height = 16 + 46 * grown;
  const width = (17 + 8 * grown) * (1 - 0.3 * k);

  ctx.save();
  ctx.translate(BASE_X, BASE_Y);
  if (dead) ctx.rotate(0.35);

  const pill = (x: number, y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
    ctx.fill();
  };

  if (t > 0.45) {
    const arm = 7 * (1 - 0.3 * k);
    pill(-width / 2 - 11, -height * 0.5, 14, arm, body);
    pill(-width / 2 - 11, -height * 0.5 - 13 * grown, arm, 13 * grown + arm, body);
  }
  if (t > 0.7) {
    const arm = 7 * (1 - 0.3 * k);
    pill(width / 2 - 3, -height * 0.68, 14, arm, body);
    pill(width / 2 + 4, -height * 0.68 - 10 * grown, arm, 10 * grown + arm, body);
  }
  pill(-width / 2, -height, width, height + 4, body);

  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.4;
  for (const x of [-width * 0.2, width * 0.2]) {
    ctx.beginPath();
    ctx.moveTo(x, -height + 7);
    ctx.lineTo(x, -3);
    ctx.stroke();
  }
  ctx.fillStyle = '#f4f1d6';
  for (let y = -height + 9; y < -4; y += 9) {
    ctx.fillRect(-0.8, y, 1.6, 2.4);
  }

  if (t >= 1) {
    ctx.translate(0, -height - 1);
    petals(ctx, 6, 4.5, 2.6, 4.2, mix('#f58fb8', BROWN, k));
    ellipse(ctx, 0, 0, 2.6, 2.6, mix('#ffd84a', BROWN, k));
  }
  ctx.restore();
}

/**
 * Draws a plant into a w x h box.
 * `t` is growth from 0 (seed) to 1 (full bloom), `decay` is 0 (healthy) to 1 (about to die).
 */
export function drawPlant(
  ctx: CanvasRenderingContext2D,
  type: string,
  t: number,
  decay: number,
  dead: boolean,
  w: number,
  wet = false,
): void {
  ctx.save();
  ctx.scale(w / 100, w / 100);
  drawSoil(ctx, wet);
  if (t <= 0 && !dead) {
    ellipse(ctx, BASE_X, BASE_Y - 1, 3.4, 2.4, '#e2cf9c');
  } else if (type === 'cactus') {
    drawCactus(ctx, t, decay, dead);
  } else {
    drawFlower(ctx, FLOWERS[type] ?? FLOWERS.daisy, t, decay, dead);
  }
  ctx.restore();
}

/** Sizes a canvas for crisp drawing and returns its context. Height follows the 100 x 110 design box. */
export function plantCanvas(canvas: HTMLCanvasElement, w: number): CanvasRenderingContext2D {
  const h = w * 1.1;
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  return ctx;
}

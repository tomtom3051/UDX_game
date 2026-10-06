// A pot is a lathe profile: one radius per height slice, plus a glaze per slice.
// It is drawn as a shaded, mirrored silhouette, which reads as a 3D pot on a wheel.
import { POTTERY } from '../config';

export type Pattern = 'solid' | 'dots' | 'stripes';

export interface Pot {
  id: string;
  /** Radius per slice in px, index 0 is the base. */
  radii: number[];
  /** Height in px. */
  height: number;
  /** Glaze colour per slice, null is bare clay. */
  colours: (string | null)[];
  patterns: Pattern[];
}

export function newPot(): Pot {
  const n = POTTERY.rows;
  // A soft lump of clay: slightly wider in the middle, rounded at the top.
  const radii = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return POTTERY.startRadius * (0.92 + 0.14 * Math.sin(t * Math.PI) - 0.1 * t * t);
  });
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    radii,
    height: POTTERY.startHeight,
    colours: Array(n).fill(null),
    patterns: Array(n).fill('solid'),
  };
}

export function clonePot(pot: Pot): Pot {
  return { ...pot, radii: [...pot.radii], colours: [...pot.colours], patterns: [...pot.patterns] };
}

/** Builds a pot from a profile function, used for the duel preview. */
export function potFromProfile(profile: (t: number) => number, height: number, bands: [number, number, string, Pattern][]): Pot {
  const pot = newPot();
  const n = pot.radii.length;
  pot.height = height;
  pot.radii = pot.radii.map((_, i) => profile(i / (n - 1)));
  for (const [from, to, colour, pattern] of bands) {
    for (let i = Math.floor(from * n); i < Math.min(n, Math.ceil(to * n)); i++) {
      pot.colours[i] = colour;
      pot.patterns[i] = pattern;
    }
  }
  return pot;
}

/** Mixes a hex colour towards white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * k);
  return `rgb(${mix((v >> 16) & 255)}, ${mix((v >> 8) & 255)}, ${mix(v & 255)})`;
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}

function bodyGradient(ctx: CanvasRenderingContext2D, cx: number, r: number, colour: string): CanvasGradient {
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, shade(colour, -0.38));
  g.addColorStop(0.22, shade(colour, 0.08));
  g.addColorStop(0.36, shade(colour, 0.3));
  g.addColorStop(0.58, colour);
  g.addColorStop(1, shade(colour, -0.48));
  return g;
}

/**
 * Draws a pot standing on (cx, baseY).
 * `spin` rotates the patterns, `wet` adds the moving sheen of clay on a turning wheel.
 */
export function drawPot(
  ctx: CanvasRenderingContext2D,
  pot: Pot,
  cx: number,
  baseY: number,
  scale = 1,
  spin = 0,
  wet = false,
): void {
  const n = pot.radii.length;
  const rowH = (pot.height * scale) / (n - 1);
  const R = (i: number) => pot.radii[i] * scale;
  const Y = (i: number) => baseY - i * rowH;
  const colour = (i: number) => pot.colours[i] ?? POTTERY.clay;
  const squash = 0.2; // how flat the ellipses of the base and rim look

  // Base: lower half of an ellipse.
  ctx.fillStyle = bodyGradient(ctx, cx, R(0), colour(0));
  ctx.beginPath();
  ctx.ellipse(cx, baseY, R(0), R(0) * squash, 0, 0, Math.PI);
  ctx.fill();

  // Body: one shaded band per slice.
  for (let i = 0; i < n - 1; i++) {
    const r0 = R(i);
    const r1 = R(i + 1);
    ctx.fillStyle = bodyGradient(ctx, cx, Math.max(r0, r1), colour(i));
    ctx.beginPath();
    ctx.moveTo(cx - r0, Y(i) + 0.6);
    ctx.lineTo(cx + r0, Y(i) + 0.6);
    ctx.lineTo(cx + r1, Y(i + 1));
    ctx.lineTo(cx - r1, Y(i + 1));
    ctx.closePath();
    ctx.fill();
  }

  // Patterns sit on the surface and turn with the wheel.
  for (let i = 0; i < n - 1; i++) {
    const pattern = pot.patterns[i];
    const glaze = pot.colours[i];
    if (pattern === 'solid' || !glaze) continue;
    ctx.fillStyle = luminance(glaze) > 0.6 ? '#5a3a28' : '#fff3dc';
    if (pattern === 'dots' && i % 3 === 1) {
      for (let k = 0; k < 10; k++) {
        const angle = spin + (k * Math.PI * 2) / 10 + (i % 6 === 1 ? 0 : Math.PI / 10);
        const facing = Math.cos(angle);
        if (facing < 0.12) continue;
        ctx.globalAlpha = Math.min(1, facing * 1.4);
        ctx.beginPath();
        ctx.ellipse(cx + R(i) * Math.sin(angle), Y(i), 3.2 * scale * facing, 3.2 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern === 'stripes') {
      for (let k = 0; k < 12; k++) {
        const angle = spin + (k * Math.PI * 2) / 12;
        const facing = Math.cos(angle);
        if (facing < 0.12) continue;
        const half = 3 * scale * facing;
        const x0 = cx + R(i) * Math.sin(angle);
        const x1 = cx + R(i + 1) * Math.sin(angle);
        ctx.globalAlpha = Math.min(1, facing * 1.4);
        ctx.beginPath();
        ctx.moveTo(x0 - half, Y(i) + 0.6);
        ctx.lineTo(x0 + half, Y(i) + 0.6);
        ctx.lineTo(x1 + half, Y(i + 1));
        ctx.lineTo(x1 - half, Y(i + 1));
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // Faint throwing rings.
  ctx.strokeStyle = 'rgba(60, 30, 10, 0.07)';
  ctx.lineWidth = Math.max(0.5, scale);
  for (let i = 3; i < n - 2; i += 4) {
    ctx.beginPath();
    ctx.moveTo(cx - R(i) * 0.96, Y(i));
    ctx.lineTo(cx + R(i) * 0.96, Y(i));
    ctx.stroke();
  }

  // Wet sheen drifting across the surface while the wheel turns.
  if (wet) {
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 6; k++) {
      const i = Math.floor(((k * 7 + 4) % (n - 4)) + 2);
      const angle = spin * 1.3 + k * 1.9;
      const facing = Math.cos(angle);
      if (facing < 0.2) continue;
      ctx.globalAlpha = 0.16 * facing;
      ctx.beginPath();
      ctx.ellipse(cx + R(i) * Math.sin(angle), Y(i), 9 * scale * facing, 2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Rim and opening.
  const top = n - 1;
  const rimColour = colour(top);
  ctx.fillStyle = bodyGradient(ctx, cx, R(top), rimColour);
  ctx.beginPath();
  ctx.ellipse(cx, Y(top), R(top), R(top) * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(rimColour, -0.62);
  ctx.beginPath();
  ctx.ellipse(cx, Y(top) + R(top) * 0.02, R(top) * 0.84, R(top) * squash * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

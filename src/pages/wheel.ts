import { POTTERY } from '../config';
import { navigate } from '../router';
import { sfx } from '../sound';
import { clonePot, drawPot, newPot, type Pattern, type Pot } from '../pottery/pot';
import { persistStudio, putOnShelf, studio, type Step } from '../pottery/store';
import { enterGame, isOnBreak, leaveGame, touch } from '../session';
import { toast } from '../ui';

const W = 390;
const H = 844;
const CX = W / 2;
/** Where the pot stands on the wheel. */
const BASE_Y = 590;
const MAX_UNDO = 30;

const PATTERNS: { id: Pattern; name: string }[] = [
  { id: 'solid', name: 'Solid' },
  { id: 'dots', name: 'Dots' },
  { id: 'stripes', name: 'Stripes' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function wheelPage(root: HTMLElement): void | (() => void) {
  if (isOnBreak()) {
    navigate('/pottery', true);
    return;
  }
  // Entering the wheel; if play time runs out here, the player may finish the piece.
  enterGame();
  if (!studio.current) studio.current = { pot: newPot(), step: 'shape' };
  const session = studio.current;
  let pot: Pot = session.pot;
  let step: Step = session.step;
  const undoStack: Pot[] = [];

  // Paint tools. null colour means bare clay (the eraser).
  let colour: string | null = POTTERY.glazes[4].colour;
  let brush = 1;
  let pattern: Pattern = 'solid';

  root.classList.add('wheel');
  root.innerHTML = `
    <canvas class="wheel-canvas"></canvas>
    <header class="bar wheel-bar">
      <button class="icon-btn" data-act="back" aria-label="Back to studio">←</button>
      <div class="segmented">
        <button data-step="shape">Shape</button>
        <button data-step="paint">Paint</button>
      </div>
      <button class="icon-btn" data-act="undo" aria-label="Undo">↶</button>
    </header>
    <p class="wheel-hint"></p>
    <div class="wheel-tools">
      <div class="tools-shape">
        <button class="btn small" data-act="restart">Fresh clay</button>
      </div>
      <div class="tools-paint">
        <div class="swatches">
          <button class="swatch clay" data-colour="" aria-label="Bare clay" style="background:${POTTERY.clay}">✕</button>
          ${POTTERY.glazes
            .map((g) => `<button class="swatch" data-colour="${g.colour}" aria-label="${g.name}" style="background:${g.colour}"></button>`)
            .join('')}
        </div>
        <div class="tool-row">
          <div class="segmented small" data-group="brush">
            ${POTTERY.brushes.map((b, i) => `<button data-brush="${i}">${b.name}</button>`).join('')}
          </div>
          <div class="segmented small" data-group="pattern">
            ${PATTERNS.map((p) => `<button data-pattern="${p.id}">${p.name}</button>`).join('')}
          </div>
        </div>
      </div>
      <button class="btn primary" data-act="done">Done</button>
    </div>
    <div class="overlay hidden">
      <div class="sheet">
        <h2>Lovely piece</h2>
        <canvas class="sheet-pot"></canvas>
        <button class="btn primary" data-act="shelf">${session.editing ? 'Put back on shelf' : 'Put on shelf'}</button>
        <button class="btn" data-act="keep">Keep working</button>
      </div>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.wheel-canvas')!;
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);

  const sheetCanvas = root.querySelector<HTMLCanvasElement>('.sheet-pot')!;
  sheetCanvas.width = 600;
  sheetCanvas.height = 720;
  const sheetCtx = sheetCanvas.getContext('2d')!;
  sheetCtx.setTransform(2, 0, 0, 2, 0, 0);

  const overlay = root.querySelector<HTMLElement>('.overlay')!;
  const hint = root.querySelector<HTMLElement>('.wheel-hint')!;

  function save(): void {
    session.pot = pot;
    session.step = step;
    studio.current = session;
    persistStudio();
  }

  function syncUi(): void {
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((b) => b.classList.toggle('on', b.dataset.step === step));
    root.querySelector('.tools-shape')!.classList.toggle('hidden', step !== 'shape');
    root.querySelector('.tools-paint')!.classList.toggle('hidden', step !== 'paint');
    root.querySelectorAll<HTMLElement>('[data-colour]').forEach((b) => b.classList.toggle('on', (b.dataset.colour || null) === colour));
    root.querySelectorAll<HTMLElement>('[data-brush]').forEach((b) => b.classList.toggle('on', Number(b.dataset.brush) === brush));
    root.querySelectorAll<HTMLElement>('[data-pattern]').forEach((b) => b.classList.toggle('on', b.dataset.pattern === pattern));
    hint.textContent =
      step === 'shape'
        ? 'Drag sideways on the clay to shape it. Drag the rim up or down to change the height.'
        : 'Pick a glaze and touch the pot. The wheel paints a ring for you.';
  }

  function pushUndo(): void {
    undoStack.push(clonePot(pot));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  // ------------------------------------------------------------ drawing

  let spin = 0;
  let frame = 0;
  let last = performance.now();

  function drawScene(): void {
    // Wall and table.
    ctx.fillStyle = '#f5e9da';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ecdcc8';
    ctx.fillRect(0, 0, W, 470);
    ctx.fillStyle = '#caa57e';
    ctx.fillRect(0, BASE_Y - 20, W, H);
    ctx.fillStyle = '#b98f66';
    ctx.fillRect(0, BASE_Y - 20, W, 6);

    // Wheel: splash pan, turning disc with a few marks so the spin is visible.
    ctx.fillStyle = 'rgba(70, 40, 20, 0.18)';
    ctx.beginPath();
    ctx.ellipse(CX, BASE_Y + 26, 176, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a8f96';
    ctx.beginPath();
    ctx.ellipse(CX, BASE_Y + 14, 166, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9bec5';
    ctx.beginPath();
    ctx.ellipse(CX, BASE_Y + 6, 166, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a3a8b0';
    for (let k = 0; k < 5; k++) {
      const angle = spin + (k * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.ellipse(CX + Math.cos(angle) * 138, BASE_Y + 6 + Math.sin(angle) * 33, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft shadow under the pot.
    ctx.fillStyle = 'rgba(40, 30, 20, 0.2)';
    ctx.beginPath();
    ctx.ellipse(CX, BASE_Y + 4, pot.radii[0] + 14, (pot.radii[0] + 14) * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    drawPot(ctx, pot, CX, BASE_Y, 1, spin, true);
  }

  function loop(now: number): void {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    spin += POTTERY.spinSpeed * dt;
    if (overlay.classList.contains('hidden')) {
      drawScene();
    } else {
      sheetCtx.clearRect(0, 0, 300, 360);
      drawPot(sheetCtx, pot, 150, 335, 0.95, spin * 0.15);
    }
    frame = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ touch

  const rowHeight = () => pot.height / (POTTERY.rows - 1);
  const rowAt = (y: number) => clamp(Math.round((BASE_Y - y) / rowHeight()), 0, POTTERY.rows - 1);

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  }

  let drag: { x: number; y: number; rim: boolean; row: number } | null = null;

  function shape(x: number, y: number): void {
    if (!drag) return;
    const outward = Math.abs(x - CX) - Math.abs(drag.x - CX);
    const row = rowAt(y);
    const spread = POTTERY.shapeSpread;
    for (let i = 0; i < POTTERY.rows; i++) {
      const weight = Math.exp(-((i - row) ** 2) / (2 * spread * spread));
      if (weight < 0.02) continue;
      let r = pot.radii[i] + outward * weight;
      // Relax towards the neighbours so the surface stays smooth like clay.
      const below = pot.radii[Math.max(0, i - 1)];
      const above = pot.radii[Math.min(POTTERY.rows - 1, i + 1)];
      r += ((below + above) / 2 - r) * 0.12 * weight;
      pot.radii[i] = clamp(r, POTTERY.minRadius, POTTERY.maxRadius);
    }
    if (drag.rim) {
      pot.height = clamp(pot.height - (y - drag.y), POTTERY.minHeight, POTTERY.maxHeight);
    }
  }

  function paint(y: number): void {
    if (!drag) return;
    const top = BASE_Y - pot.height;
    if (y < top - 24 || y > BASE_Y + 24) return;
    const row = rowAt(y);
    const reach = POTTERY.brushes[brush].rows;
    // Fill every row between the last and the current position so fast strokes leave no gaps.
    const from = Math.min(row, drag.row) - reach;
    const to = Math.max(row, drag.row) + reach;
    for (let i = Math.max(0, from); i <= Math.min(POTTERY.rows - 1, to); i++) {
      pot.colours[i] = colour;
      pot.patterns[i] = colour ? pattern : 'solid';
    }
    drag.row = row;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    drag = { ...p, rim: p.y < BASE_Y - pot.height + 30, row: rowAt(p.y) };
    navigator.vibrate?.(8);
    if (step === 'paint') {
      sfx.dab();
      paint(p.y);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    touch();
    const p = toCanvas(e);
    if (step === 'shape') shape(p.x, p.y);
    else paint(p.y);
    drag.x = p.x;
    drag.y = p.y;
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    save();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ------------------------------------------------------------ buttons

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    const d = target.dataset;
    sfx.click();
    if (d.step) step = d.step as Step;
    else if (d.colour !== undefined) colour = d.colour || null;
    else if (d.brush) brush = Number(d.brush);
    else if (d.pattern) pattern = d.pattern as Pattern;
    else if (d.act === 'undo') {
      const previous = undoStack.pop();
      if (previous) pot = previous;
    } else if (d.act === 'restart') {
      pushUndo();
      // A reworked shelf piece keeps its paint, so starting the shape over does not wipe it.
      pot = session.editing
        ? { ...newPot(), id: pot.id, colours: [...pot.colours], patterns: [...pot.patterns] }
        : { ...newPot(), id: pot.id };
    } else if (d.act === 'done') {
      overlay.classList.remove('hidden');
      sfx.win();
    } else if (d.act === 'keep') {
      overlay.classList.add('hidden');
    } else if (d.act === 'shelf') {
      putOnShelf(pot);
      navigate('/pottery', true);
      return;
    } else if (d.act === 'back') {
      save();
      navigate('/pottery');
      return;
    }
    save();
    syncUi();
  });

  syncUi();
  sfx.wheel(true);
  frame = requestAnimationFrame(loop);

  return () => {
    // Keep a stroke that was still in progress when the page closed.
    if (drag) save();
    if (leaveGame()) toast('Your play time is up. Time for a break!');
    cancelAnimationFrame(frame);
    sfx.wheel(false);
  };
}

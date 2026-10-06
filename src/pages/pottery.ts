import { navigate } from '../router';
import { muteButton, sfx } from '../sound';
import { drawPot, newPot, potFromProfile, type Pot } from '../pottery/pot';
import { persistStudio, removeFromShelf, studio } from '../pottery/store';

/** Prepares a canvas for crisp drawing at a logical size. */
function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  return ctx;
}

function drawThumb(canvas: HTMLCanvasElement, pot: Pot, w = 100, h = 126, scale = 0.33): void {
  const ctx = setupCanvas(canvas, w, h);
  drawPot(ctx, pot, w / 2, h - 12, scale, 0.4);
}

// Fixed pots for the duel preview: the example, and a close but imperfect copy.
const DUEL_EXAMPLE = potFromProfile((t) => 34 + 46 * Math.sin(t * 2.6) - 26 * t * t, 250, [
  [0, 0.3, '#2f6f9f', 'solid'],
  [0.3, 0.5, '#f3e6cf', 'dots'],
  [0.5, 0.8, '#2f6f9f', 'solid'],
  [0.8, 1, '#e8b84a', 'solid'],
]);
const DUEL_ATTEMPT = potFromProfile((t) => 40 + 38 * Math.sin(t * 2.4) - 20 * t * t, 232, [
  [0, 0.34, '#2f6f9f', 'solid'],
  [0.34, 0.5, '#f3e6cf', 'dots'],
  [0.5, 0.84, '#2f6f9f', 'solid'],
  [0.84, 1, '#e8b84a', 'solid'],
]);

export function potteryPage(root: HTMLElement): () => void {
  root.classList.add('pottery');
  let frame = 0;

  function render(): void {
    cancelAnimationFrame(frame);
    const current = studio.current;
    root.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="back" aria-label="Back to hub">←</button>
        <h1>Pottery Wheel</h1>
        <span class="mute-slot"></span>
      </header>

      <div class="studio-hero">
        <canvas class="hero-pot"></canvas>
        <div class="hero-text">
          <b>${current ? 'Your piece is waiting' : 'Ready when you are'}</b>
          <p>${current ? 'Pick up right where you left off.' : 'Shape it, paint it, take your time. There is no timer and no wrong pot.'}</p>
          <button class="btn primary small" data-act="${current ? 'continue' : 'new'}">${current ? 'Continue piece' : 'New piece'}</button>
          ${current ? '<button class="link-btn" data-act="new">or start a new one</button>' : ''}
        </div>
      </div>

      <h2 class="section-title">Your shelf <span>${studio.shelf.length ? `· ${studio.shelf.length}` : ''}</span></h2>
      ${
        studio.shelf.length
          ? `<div class="shelf">${studio.shelf
              .map((p) => `<button class="shelf-pot" data-pot="${p.id}" aria-label="View piece"><canvas></canvas></button>`)
              .join('')}</div>`
          : `<div class="shelf-empty">🏺<p>Your shelf is waiting for its first piece.</p></div>`
      }

      <button class="duel-card" data-act="duel">
        <span class="duel-icon">⚔️</span>
        <span class="duel-text"><b>Pottery duel</b><span>Two players, one example pot. Who gets closest?</span></span>
        <span class="badge badge-soon">Coming soon</span>
      </button>

      <div class="overlay hidden"></div>
    `;
    root.querySelector('.mute-slot')!.append(muteButton());

    drawThumb(root.querySelector<HTMLCanvasElement>('.hero-pot')!, current?.pot ?? newPot(), 120, 150, 0.4);
    root.querySelectorAll<HTMLElement>('.shelf-pot').forEach((el) => {
      const pot = studio.shelf.find((p) => p.id === el.dataset.pot)!;
      drawThumb(el.querySelector('canvas')!, pot);
    });
  }

  function openSheet(html: string): HTMLElement {
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    overlay.innerHTML = `<div class="sheet">${html}</div>`;
    overlay.classList.remove('hidden');
    return overlay;
  }

  function closeSheet(): void {
    cancelAnimationFrame(frame);
    root.querySelector('.overlay')?.classList.add('hidden');
  }

  function showPot(pot: Pot): void {
    const overlay = openSheet(`
      <canvas class="sheet-pot"></canvas>
      <button class="btn primary" data-act="close">Close</button>
      <button class="btn danger" data-remove="${pot.id}">Remove from shelf</button>
    `);
    const ctx = setupCanvas(overlay.querySelector('canvas')!, 300, 360);
    const start = performance.now();
    const loop = (now: number) => {
      ctx.clearRect(0, 0, 300, 360);
      drawPot(ctx, pot, 150, 335, 0.95, (now - start) / 1400);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }

  function showDuel(): void {
    const overlay = openSheet(`
      <span class="badge badge-soon">Planned feature</span>
      <h2>Pottery duel</h2>
      <p class="sheet-text">Two players get the same example pot and each try to recreate it. The closest match wins. An optional mode, next to free creating.</p>
      <div class="duel-mock">
        <div><canvas class="duel-a"></canvas><span>Example</span></div>
        <div class="duel-vs">vs</div>
        <div><canvas class="duel-b"></canvas><span>Your pot</span></div>
      </div>
      <div class="duel-score"><b>87%</b> match</div>
      <button class="btn primary" data-act="close">Got it</button>
    `);
    drawThumb(overlay.querySelector<HTMLCanvasElement>('.duel-a')!, DUEL_EXAMPLE, 120, 150, 0.5);
    drawThumb(overlay.querySelector<HTMLCanvasElement>('.duel-b')!, DUEL_ATTEMPT, 120, 150, 0.5);
  }

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-pot],[data-remove]');
    if (!target) return;
    sfx.click();
    const { act, pot, remove } = target.dataset;
    if (act === 'back') navigate('/');
    else if (act === 'continue') navigate('/pottery/wheel');
    else if (act === 'new') {
      studio.current = { pot: newPot(), step: 'shape' };
      persistStudio();
      navigate('/pottery/wheel');
    } else if (act === 'duel') showDuel();
    else if (act === 'close') closeSheet();
    else if (pot) showPot(studio.shelf.find((p) => p.id === pot)!);
    else if (remove) {
      removeFromShelf(remove);
      render();
    }
  });

  render();
  return () => cancelAnimationFrame(frame);
}

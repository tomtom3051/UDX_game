import Phaser from 'phaser';
import { getMap, MAPS, PASS_COVERAGE, SPEED_TIERS, WIDTH_TIERS } from '../config';
import { LawnScene, VIEW_H, VIEW_W, type HudState } from '../game/LawnScene';
import { BLOCKED, MOWED, type Grid } from '../game/grid';
import { betterGrade, gradeJob, isPass, type JobOutcome } from '../grading';
import { navigate } from '../router';
import { muteButton, sfx } from '../sound';
import { cooldownRemaining, persist, save, setLastReport, startCooldown } from '../state';

function formatClock(seconds: number): string {
  const total = Math.ceil(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function gamePage(root: HTMLElement, [mapId]: string[]): void | (() => void) {
  const map = getMap(mapId);
  const required = map?.requires ? MAPS.find((m) => m.id === map.requires) : undefined;
  const locked = required !== undefined && !isPass(save.best[required.id]);
  if (!map || locked || cooldownRemaining() > 0) {
    navigate('/lawn', true);
    return;
  }

  root.classList.add('game');
  root.innerHTML = `
    <div class="game-canvas"></div>
    <div class="hud">
      <div class="hud-row">
        <div class="pill time"><span>⏱</span><b class="hud-time"></b></div>
        <div class="pill coverage">
          <div class="cov-text"><b class="hud-cov">0%</b><span>mowed</span></div>
          <div class="cov-bar"><i class="cov-fill"></i><em style="left:${PASS_COVERAGE}%"></em></div>
        </div>
        <div class="pill beds"><span>🌷</span><b class="hud-beds">0</b></div>
        <button class="icon-btn pause-btn" aria-label="Pause">⏸</button>
      </div>
      <div class="hud-row second">
        <canvas class="minimap"></canvas>
        <button class="btn accent small finish hidden">✓ Finish job</button>
      </div>
    </div>
    <div class="countdown-text hidden"></div>
    <div class="overlay hidden">
      <div class="sheet">
        <h2>Paused</h2>
        <button class="btn primary" data-act="resume">Resume</button>
        <button class="btn danger" data-act="quit">Quit job</button>
        <p class="footnote">Quitting counts as a failed job.</p>
        <span class="mute-slot"></span>
      </div>
    </div>
  `;
  root.querySelector('.mute-slot')!.append(muteButton());

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const timeEl = $('.hud-time');
  const covEl = $('.hud-cov');
  const covFill = $('.cov-fill');
  const bedsEl = $('.hud-beds');
  const finishBtn = $<HTMLButtonElement>('.finish');
  const countdownEl = $('.countdown-text');
  const overlay = $('.overlay');
  const minimap = $<HTMLCanvasElement>('.minimap');

  let shownBeds = 0;
  function onHud(h: HudState): void {
    timeEl.textContent = formatClock(h.timeLeft);
    timeEl.parentElement!.classList.toggle('low', h.timeLeft <= 15);
    covEl.textContent = `${Math.floor(h.coverage)}%`;
    covFill.style.width = `${h.coverage}%`;
    covFill.classList.toggle('pass', h.coverage >= PASS_COVERAGE);
    if (h.beds !== shownBeds) {
      shownBeds = h.beds;
      bedsEl.textContent = String(h.beds);
      const pill = bedsEl.parentElement!;
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump', 'hit');
    }
    finishBtn.classList.toggle('hidden', !h.canFinish);
  }

  function onCountdown(text: string | null): void {
    countdownEl.classList.toggle('hidden', text === null);
    if (text === null) return;
    countdownEl.textContent = text;
    countdownEl.classList.remove('pop');
    void countdownEl.offsetWidth;
    countdownEl.classList.add('pop');
  }

  // Minimap: one pixel per grass cell, scaled up with CSS.
  const mini = minimap.getContext('2d')!;
  let image: ImageData | null = null;
  function onMinimap(grid: Grid, x: number, y: number): void {
    if (!image) {
      minimap.width = grid.cols;
      minimap.height = grid.rows;
      minimap.style.height = `${Math.round((48 * grid.rows) / grid.cols)}px`;
      image = mini.createImageData(grid.cols, grid.rows);
    }
    const data = image.data;
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i];
      const [r, g, b] = cell === MOWED ? [176, 232, 110] : cell === BLOCKED ? [70, 80, 70] : [40, 110, 45];
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    mini.putImageData(image, 0, 0);
    mini.fillStyle = '#e5483f';
    const dot = Math.max(3, Math.round(grid.cols / 16));
    mini.fillRect((x / map!.width) * grid.cols - dot / 2, (y / map!.height) * grid.rows - dot / 2, dot, dot);
  }

  let ended = false;
  function onEnd(outcome: JobOutcome): void {
    if (ended) return;
    ended = true;
    const report = gradeJob(outcome, map!);
    save.money += report.payout;
    save.best[map!.id] = betterGrade(save.best[map!.id], report.grade);
    persist();
    startCooldown();
    setLastReport(report);
    navigate('/lawn/results', true);
  }

  const scene = new LawnScene({
    map,
    speed: SPEED_TIERS[save.speedTier],
    width: WIDTH_TIERS[save.widthTier],
    onHud,
    onCountdown,
    onMinimap,
    onEnd,
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: VIEW_W,
    height: VIEW_H,
    parent: $('.game-canvas'),
    scale: { mode: Phaser.Scale.NONE },
    audio: { noAudio: true },
    banner: false,
    scene,
  });

  // The phone frame is scaled with CSS, so Phaser has to re-measure the canvas for input.
  const refresh = () => game.scale.refresh();
  game.events.once(Phaser.Core.Events.READY, refresh);
  window.addEventListener('resize', refresh);

  function setPaused(paused: boolean): void {
    if (ended) return;
    overlay.classList.toggle('hidden', !paused);
    if (paused) {
      game.scene.pause('lawn');
      sfx.engine(false);
    } else {
      game.scene.resume('lawn');
      if (scene.playing) sfx.engine(true);
    }
  }

  $('.pause-btn').addEventListener('click', () => {
    sfx.click();
    setPaused(true);
  });
  overlay.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (action === 'resume') {
      sfx.click();
      setPaused(false);
    } else if (action === 'quit') {
      sfx.engine(false);
      scene.end('quit');
    }
  });
  finishBtn.addEventListener('click', () => scene.end('finished'));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setPaused(overlay.classList.contains('hidden'));
  };
  window.addEventListener('keydown', onKey);

  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', refresh);
    sfx.engine(false);
    game.destroy(true);
  };
}

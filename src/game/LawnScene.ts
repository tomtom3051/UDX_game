import Phaser from 'phaser';
import { CELL, PASS_COVERAGE, type MapDef, type Obstacle } from '../config';
import type { EndReason, JobOutcome } from '../grading';
import { sfx } from '../sound';
import { buildGrid, circleHitsObstacle, coveragePercent, GRASS, MOWED, type Grid } from './grid';

export const VIEW_W = 390;
export const VIEW_H = 844;

/** Space kept free for the HTML HUD above the map. */
const HUD_SPACE = 150;
const MOWER_RADIUS = 13;
/** Front to back size of the cutting deck. */
const DECK_DEPTH = 20;
const JOYSTICK_RADIUS = 52;

const COLOURS = {
  hedge: 0x2c5f2a,
  grass: 0x3d8b37,
  grassDark: 0x327a2e,
  grassLight: 0x4a9a42,
  mowedA: 0x9bd65a,
  mowedB: 0x8ccb4e,
};

export interface HudState {
  timeLeft: number;
  coverage: number;
  beds: number;
  canFinish: boolean;
}

export interface SceneOpts {
  map: MapDef;
  speed: number;
  width: number;
  onHud(state: HudState): void;
  onCountdown(text: string | null): void;
  onMinimap(grid: Grid, x: number, y: number): void;
  onEnd(outcome: JobOutcome): void;
}

type RectObstacle = Exclude<Obstacle, { type: 'tree' }>;
interface Bed {
  rect: RectObstacle;
  gfx: Phaser.GameObjects.Graphics;
  destroyed: boolean;
}

export class LawnScene extends Phaser.Scene {
  private grid!: Grid;
  private lawn!: Phaser.GameObjects.RenderTexture;
  private mower!: Phaser.GameObjects.Container;
  private clippings!: Phaser.GameObjects.Particles.ParticleEmitter;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private stickVector = new Phaser.Math.Vector2();

  private solids: Obstacle[] = [];
  private pools: RectObstacle[] = [];
  private beds: Bed[] = [];

  private state: 'countdown' | 'playing' | 'ended' = 'countdown';
  private timeLeft = 0;
  private heading = -Math.PI / 2;
  private bedsDestroyed = 0;
  private minimapTimer = 0;

  constructor(private readonly opts: SceneOpts) {
    super('lawn');
  }

  create(): void {
    const { map } = this.opts;
    this.grid = buildGrid(map);
    this.timeLeft = map.timeLimit;

    this.makeTextures();
    this.cameras.main.setBackgroundColor(COLOURS.hedge);

    this.add.tileSprite(0, 0, map.width, map.height, 'grass').setOrigin(0);
    this.lawn = this.add.renderTexture(0, 0, map.width, map.height).setOrigin(0);

    const border = this.add.graphics();
    border.lineStyle(10, 0x8a623a).strokeRect(-5, -5, map.width + 10, map.height + 10);
    border.lineStyle(2, 0x5f4124).strokeRect(-10, -10, map.width + 20, map.height + 20);

    this.drawObstacles();
    this.mower = this.makeMower();
    this.mower.setPosition(map.start.x, map.start.y).setRotation(this.heading).setDepth(5);

    this.clippings = this.add
      .particles(0, 0, 'clip', {
        speed: { min: 30, max: 90 },
        lifespan: { min: 250, max: 500 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: [0xc6ec8a, 0x9bd65a, 0x6fb53c],
        emitting: false,
      })
      .setDepth(6);

    this.setupCamera();
    this.setupInput();
    this.cut();
    this.pushHud();
    this.opts.onMinimap(this.grid, this.mower.x, this.mower.y);
    this.runCountdown();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.engine(false));
  }

  // ------------------------------------------------------------ setup

  private makeTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLOURS.grass).fillRect(0, 0, 16, 16);
    g.fillStyle(COLOURS.grassDark);
    g.fillRect(2, 1, 2, 7).fillRect(10, 8, 2, 7).fillRect(6, 11, 2, 5).fillRect(13, 2, 2, 5);
    g.fillStyle(COLOURS.grassLight);
    g.fillRect(6, 3, 2, 5).fillRect(1, 10, 2, 4).fillRect(12, 12, 2, 3);
    g.generateTexture('grass', 16, 16);
    g.clear();
    g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
    g.generateTexture('clip', 4, 4);
    // Mowed cell stamps, one pixel oversized so neighbouring cells leave no seams.
    g.clear().fillStyle(COLOURS.mowedA).fillRect(0, 0, CELL + 1, CELL + 1);
    g.generateTexture('mowedA', CELL + 1, CELL + 1);
    g.clear().fillStyle(COLOURS.mowedB).fillRect(0, 0, CELL + 1, CELL + 1);
    g.generateTexture('mowedB', CELL + 1, CELL + 1);
    g.destroy();
  }

  private setupCamera(): void {
    const { map } = this.opts;
    const cam = this.cameras.main;
    const pad = 16;
    // Maps smaller than the view are centred, larger maps scroll with the mower.
    const fullW = map.width + pad * 2;
    const fullH = map.height + HUD_SPACE + pad;
    const boundsW = Math.max(fullW, VIEW_W);
    const boundsH = Math.max(fullH, VIEW_H);
    cam.setBounds(-pad - (boundsW - fullW) / 2, -HUD_SPACE - (boundsH - fullH) / 2, boundsW, boundsH);
    cam.startFollow(this.mower, true, 0.12, 0.12);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      a: kb.addKey(K.A),
      s: kb.addKey(K.S),
      d: kb.addKey(K.D),
    };

    this.stick = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < VIEW_H / 2) return;
      this.stickOrigin = new Phaser.Math.Vector2(p.x, p.y);
      this.updateStick(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.stickOrigin && p.isDown) this.updateStick(p);
    });
    const release = () => {
      this.stickOrigin = null;
      this.stickVector.set(0, 0);
      this.stick.clear();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', release);
  }

  private updateStick(p: Phaser.Input.Pointer): void {
    const origin = this.stickOrigin!;
    const v = new Phaser.Math.Vector2(p.x - origin.x, p.y - origin.y);
    if (v.length() > JOYSTICK_RADIUS) v.setLength(JOYSTICK_RADIUS);
    this.stickVector.copy(v).scale(1 / JOYSTICK_RADIUS);
    this.stick.clear();
    this.stick.fillStyle(0xffffff, 0.25).fillCircle(origin.x, origin.y, JOYSTICK_RADIUS + 10);
    this.stick.lineStyle(3, 0xffffff, 0.7).strokeCircle(origin.x, origin.y, JOYSTICK_RADIUS + 10);
    this.stick.fillStyle(0xffffff, 0.9).fillCircle(origin.x + v.x, origin.y + v.y, 24);
  }

  private runCountdown(): void {
    const steps = ['3', '2', '1', 'Go!'];
    steps.forEach((text, i) => {
      this.time.delayedCall(i * 750, () => {
        this.opts.onCountdown(text);
        if (i < 3) sfx.beep();
        else sfx.go();
      });
    });
    this.time.delayedCall(3 * 750, () => {
      this.state = 'playing';
      sfx.engine(true);
    });
    this.time.delayedCall(4 * 750, () => this.opts.onCountdown(null));
  }

  // ------------------------------------------------------------ drawing

  private makeMower(): Phaser.GameObjects.Container {
    const w = this.opts.width;
    const g = this.add.graphics();
    // The mower faces +x. The yellow deck is exactly the cutting area.
    g.lineStyle(4, 0x4a4a4a).beginPath();
    g.moveTo(-10, -8).lineTo(-30, -8).lineTo(-30, 8).lineTo(-10, 8).strokePath();
    g.fillStyle(0x2b2b2b);
    g.fillRoundedRect(-16, -17, 12, 6, 2).fillRoundedRect(-16, 11, 12, 6, 2);
    g.fillStyle(0xf2a93b).fillRoundedRect(-DECK_DEPTH / 2, -w / 2, DECK_DEPTH, w, 6);
    g.lineStyle(2, 0x7a4b0c).strokeRoundedRect(-DECK_DEPTH / 2, -w / 2, DECK_DEPTH, w, 6);
    g.fillStyle(0xe5483f).fillRoundedRect(-14, -12, 26, 24, 7);
    g.lineStyle(2, 0x8f1f1a).strokeRoundedRect(-14, -12, 26, 24, 7);
    g.fillStyle(0x8f1f1a).fillCircle(-1, 0, 5);
    g.fillStyle(0xffd9d6).fillCircle(-1, 0, 2);
    return this.add.container(0, 0, [g]);
  }

  private drawObstacles(): void {
    const ground = this.add.graphics().setDepth(2);
    const canopy = this.add.graphics().setDepth(10);

    for (const o of this.opts.map.obstacles) {
      switch (o.type) {
        case 'pool':
          this.pools.push(o);
          ground.fillStyle(0xdfe7ea).fillRoundedRect(o.x, o.y, o.w, o.h, 12);
          ground.fillStyle(0x3fb4e6).fillRoundedRect(o.x + 6, o.y + 6, o.w - 12, o.h - 12, 8);
          ground.lineStyle(3, 0x8fd8f5, 0.9);
          for (let y = o.y + 24; y < o.y + o.h - 14; y += 22) {
            ground.lineBetween(o.x + 20, y, o.x + o.w * 0.45, y);
            ground.lineBetween(o.x + o.w * 0.55, y + 9, o.x + o.w - 20, y + 9);
          }
          break;
        case 'bed': {
          const gfx = this.add.graphics().setDepth(2);
          const bed: Bed = { rect: o, gfx, destroyed: false };
          this.beds.push(bed);
          this.drawBed(bed);
          break;
        }
        case 'house':
          this.solids.push(o);
          ground.fillStyle(0xc9563c).fillRect(o.x, o.y, o.w, o.h);
          ground.fillStyle(0xb24a33).fillRect(o.x, o.y + o.h / 2, o.w, o.h / 2);
          ground.lineStyle(4, 0xe98a72).lineBetween(o.x, o.y + o.h / 2, o.x + o.w, o.y + o.h / 2);
          ground.lineStyle(3, 0x7d2f1e).strokeRect(o.x, o.y, o.w, o.h);
          ground.fillStyle(0x6b6b6b).fillRect(o.x + o.w * 0.72, o.y + o.h * 0.2, 22, 22);
          break;
        case 'shed':
          this.solids.push(o);
          ground.fillStyle(0x8d6e63).fillRect(o.x, o.y, o.w, o.h);
          ground.lineStyle(2, 0x6d4c41);
          for (let x = o.x + 12; x < o.x + o.w; x += 12) ground.lineBetween(x, o.y, x, o.y + o.h);
          ground.lineStyle(3, 0x4e342e).strokeRect(o.x, o.y, o.w, o.h);
          break;
        case 'fence':
          this.solids.push(o);
          ground.fillStyle(0xc9a26b).fillRect(o.x, o.y, o.w, o.h);
          ground.lineStyle(1, 0x7a5a30).strokeRect(o.x, o.y, o.w, o.h);
          break;
        case 'tree':
          this.solids.push(o);
          ground.fillStyle(0x1f4d1e, 0.35).fillCircle(o.x + 5, o.y + 7, o.r);
          canopy.fillStyle(0x2a6e2c).fillCircle(o.x, o.y, o.r);
          canopy.fillStyle(0x3b8f3d).fillCircle(o.x - o.r * 0.2, o.y - o.r * 0.2, o.r * 0.68);
          canopy.fillStyle(0x58ad52).fillCircle(o.x - o.r * 0.32, o.y - o.r * 0.32, o.r * 0.32);
          break;
      }
    }
  }

  private drawBed(bed: Bed): void {
    const { rect: o, gfx } = bed;
    const rnd = new Phaser.Math.RandomDataGenerator([`${o.x}-${o.y}`]);
    gfx.clear();
    gfx.fillStyle(bed.destroyed ? 0x57371f : 0x7a4e2d).fillRoundedRect(o.x, o.y, o.w, o.h, 8);
    gfx.lineStyle(2, 0x4a2e18).strokeRoundedRect(o.x, o.y, o.w, o.h, 8);
    const petals = [0xff7eb6, 0xffd23f, 0xffffff, 0xff5a5a, 0xc59bff];
    const count = Math.round((o.w * o.h) / 230);
    for (let i = 0; i < count; i++) {
      const x = rnd.between(o.x + 9, o.x + o.w - 9);
      const y = rnd.between(o.y + 9, o.y + o.h - 9);
      const colour = rnd.pick(petals);
      if (bed.destroyed) {
        gfx.fillStyle(colour, 0.45).fillEllipse(x, y, 9, 4);
      } else {
        gfx.fillStyle(0x3f9142).fillCircle(x, y, 6);
        gfx.fillStyle(colour).fillCircle(x, y, 4.5);
        gfx.fillStyle(0xffb300).fillCircle(x, y, 1.6);
      }
    }
    if (bed.destroyed) {
      gfx.lineStyle(4, 0x3b2413, 0.8);
      gfx.lineBetween(o.x + 6, o.y + o.h * 0.35, o.x + o.w - 6, o.y + o.h * 0.35);
      gfx.lineBetween(o.x + 6, o.y + o.h * 0.65, o.x + o.w - 6, o.y + o.h * 0.65);
    }
  }

  // ------------------------------------------------------------ loop

  update(_time: number, deltaMs: number): void {
    if (this.state !== 'playing') return;
    const dt = Math.min(deltaMs, 50) / 1000;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.pushHud();
      this.end('time');
      return;
    }

    const dir = this.readInput();
    const amount = Math.min(1, dir.length());
    if (amount > 0.05) {
      const target = Math.atan2(dir.y, dir.x);
      this.heading = Phaser.Math.Angle.RotateTo(this.heading, target, 9 * dt);
      this.mower.setRotation(this.heading);

      const step = this.opts.speed * amount * dt;
      const nx = this.mower.x + (dir.x / dir.length()) * step;
      const ny = this.mower.y + (dir.y / dir.length()) * step;
      // Move per axis so the mower slides along walls instead of sticking.
      if (!this.isBlocked(nx, this.mower.y)) this.mower.x = nx;
      if (!this.isBlocked(this.mower.x, ny)) this.mower.y = ny;
    }

    const cutCount = this.cut();
    if (cutCount > 0) {
      this.clippings.emitParticleAt(this.mower.x, this.mower.y, Math.min(3, cutCount));
    }

    this.checkBeds();
    if (this.checkPool()) return;

    this.pushHud();
    this.minimapTimer += deltaMs;
    if (this.minimapTimer > 200) {
      this.minimapTimer = 0;
      this.opts.onMinimap(this.grid, this.mower.x, this.mower.y);
    }
  }

  private readInput(): Phaser.Math.Vector2 {
    const k = this.keys;
    const v = new Phaser.Math.Vector2(
      (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
      (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
    );
    if (v.lengthSq() > 0) return v.normalize();
    return this.stickVector.clone();
  }

  private isBlocked(x: number, y: number): boolean {
    const { map } = this.opts;
    if (x < MOWER_RADIUS || y < MOWER_RADIUS || x > map.width - MOWER_RADIUS || y > map.height - MOWER_RADIUS) {
      return true;
    }
    return this.solids.some((o) => circleHitsObstacle(o, x, y, MOWER_RADIUS));
  }

  /** Cuts every grass cell under the deck. Returns the number of newly cut cells. */
  private cut(): number {
    const { grid } = this;
    const halfW = this.opts.width / 2;
    const halfD = DECK_DEPTH / 2;
    const reach = Math.hypot(halfW, halfD);
    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);
    const mx = this.mower.x;
    const my = this.mower.y;

    const x0 = Math.max(0, Math.floor((mx - reach) / CELL));
    const x1 = Math.min(grid.cols - 1, Math.floor((mx + reach) / CELL));
    const y0 = Math.max(0, Math.floor((my - reach) / CELL));
    const y1 = Math.min(grid.rows - 1, Math.floor((my + reach) / CELL));

    const cutCells: number[] = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const i = cy * grid.cols + cx;
        if (grid.cells[i] !== GRASS) continue;
        const dx = cx * CELL + CELL / 2 - mx;
        const dy = cy * CELL + CELL / 2 - my;
        // Cell centre in mower space: forward along the heading, side across the deck.
        const forward = dx * cos + dy * sin;
        const side = -dx * sin + dy * cos;
        if (Math.abs(forward) > halfD || Math.abs(side) > halfW) continue;
        grid.cells[i] = MOWED;
        grid.mowed++;
        cutCells.push(cx, cy);
      }
    }
    const count = cutCells.length / 2;
    if (count > 0) {
      // Stamp the cut cells into the render texture in one batch.
      this.lawn.beginDraw();
      for (let n = 0; n < cutCells.length; n += 2) {
        const cx = cutCells[n];
        const stripe = Math.floor(cx / 4) % 2 === 0 ? 'mowedA' : 'mowedB';
        this.lawn.batchDrawFrame(stripe, undefined, cx * CELL, cutCells[n + 1] * CELL);
      }
      this.lawn.endDraw();
    }
    return count;
  }

  private checkBeds(): void {
    for (const bed of this.beds) {
      if (bed.destroyed || !circleHitsObstacle(bed.rect, this.mower.x, this.mower.y, MOWER_RADIUS - 3)) continue;
      bed.destroyed = true;
      this.bedsDestroyed++;
      this.drawBed(bed);
      this.cameras.main.shake(160, 0.008);
      this.cameras.main.flash(180, 255, 70, 70);
      sfx.crunch();
    }
  }

  private checkPool(): boolean {
    const hit = this.pools.some((p) =>
      circleHitsObstacle({ ...p, x: p.x + 8, y: p.y + 8, w: p.w - 16, h: p.h - 16 }, this.mower.x, this.mower.y, 4),
    );
    if (!hit) return false;
    this.state = 'ended';
    sfx.engine(false);
    sfx.splash();
    this.cameras.main.shake(250, 0.012);
    this.tweens.add({
      targets: this.mower,
      scale: 0.4,
      alpha: 0.3,
      angle: this.mower.angle + 200,
      duration: 800,
      onComplete: () => this.opts.onEnd(this.outcome('pool')),
    });
    return true;
  }

  private pushHud(): void {
    const coverage = coveragePercent(this.grid);
    this.opts.onHud({
      timeLeft: this.timeLeft,
      coverage,
      beds: this.bedsDestroyed,
      canFinish: this.state === 'playing' && coverage >= PASS_COVERAGE,
    });
  }

  private outcome(reason: EndReason): JobOutcome {
    return {
      mapId: this.opts.map.id,
      coverage: coveragePercent(this.grid),
      bedsDestroyed: this.bedsDestroyed,
      timeLeft: this.timeLeft,
      reason,
    };
  }

  get playing(): boolean {
    return this.state === 'playing';
  }

  /** Ends the job. Called by the timer, the "Finish job" button and the pause menu. */
  end(reason: EndReason): void {
    if (this.state === 'ended') return;
    if (reason === 'finished' && coveragePercent(this.grid) < PASS_COVERAGE) return;
    this.state = 'ended';
    sfx.engine(false);
    this.opts.onEnd(this.outcome(reason));
  }
}

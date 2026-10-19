// Shared play session for the timed games (Lawn Mower, Pottery).
//
// Entering a timed game page starts a session that runs on the wall clock for SESSION.playMs.
// When it runs out, timed games lock for SESSION.breakMs (players may still look around).
// If play time runs out while the player is inside a game (a mower job or the pottery wheel),
// they may finish it: the break starts when they leave that game ("overtime").
// If the app was closed or left untouched for SESSION.idleResetMs, the session simply resets.
//
// The state lives in localStorage and is re-read on every check, so it survives reloads and
// stays consistent across tabs. The tab running a game sends a heartbeat; if it disappears
// (tab closed or reloaded mid-game), the game counts as finished at its last heartbeat.
import { SESSION } from './config';
import { settings } from './settings';

const KEY = 'pocket-jobs-session-v1';
/** A game whose tab has not sent a heartbeat for this long counts as finished. */
const HEARTBEAT_TIMEOUT = 5000;
/** Identifies this page load, so only the tab that is running a game may finish it. */
const TAB_ID = Math.random().toString(36).slice(2);

interface Stored {
  start: number;
  lastActive: number;
  /** Set while a tab is inside a game (mower job or pottery wheel). */
  game?: { owner: string; beat: number };
  /** When the break started, if it started after the play time ran out (overtime). */
  breakStart?: number;
}

export type Phase = 'none' | 'playing' | 'overtime' | 'break';

export interface SessionStatus {
  phase: Phase;
  /** Play time left while playing, break time left during a break, 0 otherwise. */
  remaining: number;
}

function durations() {
  return settings.fastTimers ? SESSION.fast : SESSION;
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(value: Stored | null): void {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the session only lasts for this page load.
  }
}

export function status(now = Date.now()): SessionStatus {
  const s = read();
  if (!s || now < s.start) return { phase: 'none', remaining: 0 };
  const d = durations();
  const playEnd = s.start + d.playMs;

  // When did (or will) the break start?
  let breakStart = s.breakStart;
  if (breakStart === undefined && now >= playEnd) {
    const liveGame = s.game && now - s.game.beat <= HEARTBEAT_TIMEOUT;
    if (liveGame) {
      // Overtime: the player is finishing the game they were in.
      if (now - s.lastActive >= d.idleResetMs) return { phase: 'none', remaining: 0 };
      return { phase: 'overtime', remaining: 0 };
    }
    breakStart = s.game ? Math.max(playEnd, s.game.beat) : playEnd;
  }

  if (breakStart !== undefined) {
    const breakEnd = breakStart + d.breakMs;
    if (now >= breakEnd) return { phase: 'none', remaining: 0 };
    return { phase: 'break', remaining: breakEnd - now };
  }

  // Untouched for too long: start fresh next time.
  if (now - s.lastActive >= d.idleResetMs) return { phase: 'none', remaining: 0 };
  return { phase: 'playing', remaining: playEnd - now };
}

function ownsGame(s = read()): boolean {
  return s?.game?.owner === TAB_ID;
}

/** True when this tab may play: no break, and no overtime that belongs to another tab. */
export function canPlay(): boolean {
  const { phase } = status();
  return phase === 'none' || phase === 'playing' || (phase === 'overtime' && ownsGame());
}

/** Timed games are locked for this tab (a break, or another tab finishing its game). */
export function isOnBreak(): boolean {
  return !canPlay();
}

/** True while this tab is inside a game (mower job or pottery wheel). */
export function inGameHere(): boolean {
  return ownsGame();
}

/** Called when the player enters a timed game page. Starts a session unless one is running. */
export function ensureSession(): void {
  const now = Date.now();
  if (status(now).phase === 'none') write({ start: now, lastActive: now });
  check();
}

/** Called when a game screen opens (mower job, pottery wheel). */
export function enterGame(): void {
  ensureSession();
  const s = read();
  if (!s) return;
  write({ ...s, game: { owner: TAB_ID, beat: Date.now() } });
}

/** Called when a game screen closes. If play time already ran out, the break starts now (returns true). */
export function leaveGame(): boolean {
  const s = read();
  if (!s || !ownsGame(s)) return false;
  const now = Date.now();
  const playEnd = s.start + durations().playMs;
  const next: Stored = { start: s.start, lastActive: now };
  if (s.breakStart !== undefined) next.breakStart = s.breakStart;
  else if (now >= playEnd) next.breakStart = now;
  write(next);
  check();
  return next.breakStart !== undefined;
}

/** Keeps this tab's game alive. Runs every second from main.ts. */
export function heartbeat(): void {
  const s = read();
  if (s && ownsGame(s)) write({ ...s, game: { owner: TAB_ID, beat: Date.now() } });
}

let lastTouchWrite = 0;

/** Records that the player is still here, so the idle reset does not kick in. */
export function touch(): void {
  const now = Date.now();
  if (now - lastTouchWrite < 3000) return;
  const s = read();
  const { phase } = status(now);
  if (!s || (phase !== 'playing' && phase !== 'overtime')) return;
  lastTouchWrite = now;
  write({ ...s, lastActive: now });
}

// ---------------------------------------------------------------- presenter tools

/** Ends the play time now. A game in progress may still be finished. */
export function endSessionNow(): void {
  const now = Date.now();
  const s = read();
  write({ start: now - durations().playMs, lastActive: now, ...(s?.game ? { game: s.game } : {}) });
  check();
}

export function skipBreak(): void {
  write(null);
  check();
}

// ---------------------------------------------------------------- change notifications

type Listener = (current: SessionStatus, previous: Phase) => void;
const listeners = new Set<Listener>();
let lastPhase: Phase = status().phase;
let warned = false;

export function onPhaseChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Runs every second from main.ts. Returns the current status for clocks to display. */
export function check(): SessionStatus {
  const current = status();
  if (current.phase !== lastPhase) {
    const previous = lastPhase;
    lastPhase = current.phase;
    warned = false;
    listeners.forEach((fn) => fn(current, previous));
  }
  return current;
}

/** True once per session when play time drops below the warning threshold. */
export function shouldWarn(current: SessionStatus): boolean {
  if (warned || current.phase !== 'playing' || current.remaining > durations().warnAtMs) return false;
  warned = true;
  return true;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- shared markup

/** Small "time left" line for timed game pages. The clock is updated by main.ts. */
export function sessionStripHtml(): string {
  const s = status();
  return `<div class="session-strip ${s.phase === 'playing' ? '' : 'hidden'}">⏳ <b data-session-clock>${formatClock(s.remaining)}</b> of play time left</div>`;
}

/** Break banner for timed game pages. */
export function breakBannerHtml(what: string): string {
  const s = status();
  return `
    <div class="cooldown ${isOnBreak() ? '' : 'hidden'}">
      <span class="cooldown-icon">☕</span>
      <div>
        <b>Time for a break: <span data-break-clock>${formatClock(s.remaining)}</span></b>
        <p>Your play time is used up. The pause is there to encourage a break from the screen. ${what}</p>
      </div>
    </div>`;
}

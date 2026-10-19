import { route, startRouter } from './router';
import { hubPage } from './pages/hub';
import { wipPage } from './pages/wip';
import { basePage } from './pages/base';
import { gamePage } from './pages/game';
import { resultsPage } from './pages/results';
import { potteryPage } from './pages/pottery';
import { wheelPage } from './pages/wheel';
import { gardenPage } from './pages/garden';
import { settingsPage } from './pages/settings';
import { initMusic } from './music';
import { check, formatClock, heartbeat, inGameHere, isOnBreak, shouldWarn, skipBreak, touch } from './session';
import { applyTheme } from './settings';
import { toast } from './ui';

// Theme first, so the first frame already has the player's colours.
applyTheme();
initMusic();

export const PHONE_W = 390;
export const PHONE_H = 844;

// The app always lays out at 390 x 844 and is scaled to fit the window.
// On wide screens it sits in a phone bezel, on a real phone it fills the screen.
function fitPhone(): void {
  const framed = window.innerWidth > 520;
  const margin = framed ? 44 : 0;
  const scale = Math.min((window.innerWidth - margin) / PHONE_W, (window.innerHeight - margin) / PHONE_H);
  document.documentElement.style.setProperty('--phone-scale', String(Math.min(scale, framed ? 1.25 : 10)));
  document.body.classList.toggle('framed', framed);
}

window.addEventListener('resize', fitPhone);
fitPhone();

route(/^\/$/, hubPage);
route(/^\/wip\/([\w-]+)$/, wipPage);
route(/^\/lawn$/, basePage);
route(/^\/lawn\/play\/([\w-]+)$/, gamePage);
route(/^\/lawn\/results$/, resultsPage);
route(/^\/pottery$/, potteryPage);
route(/^\/pottery\/wheel$/, wheelPage);
route(/^\/garden$/, gardenPage);
route(/^\/settings$/, settingsPage);
startRouter();

// Play session clock: one tick per second updates every visible clock and fires the warning.
function tick(): void {
  heartbeat();
  const current = check();
  const clock = formatClock(current.remaining);
  const playClock = current.phase === 'playing' ? clock : '0:00';
  document.querySelectorAll('[data-session-clock]').forEach((el) => (el.textContent = playClock));
  document.querySelectorAll('[data-break-clock]').forEach((el) => (el.textContent = clock));
  // No warning inside a game (mower job, pottery wheel): it would only add pressure.
  if (!inGameHere() && shouldWarn(current)) toast('One minute of play time left.');
}
tick();
window.setInterval(tick, 1000);

// Any interaction keeps the session from being reset as idle.
window.addEventListener('pointerdown', touch, true);
window.addEventListener('keydown', touch, true);

// Presenter shortcut, available everywhere: K skips the break.
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key.toLowerCase() === 'k' && isOnBreak()) {
    skipBreak();
    toast('Break skipped.');
  }
});

import { route, startRouter } from './router';
import { hubPage } from './pages/hub';
import { wipPage } from './pages/wip';
import { basePage } from './pages/base';
import { gamePage } from './pages/game';
import { resultsPage } from './pages/results';
import { potteryPage } from './pages/pottery';
import { wheelPage } from './pages/wheel';
import { gardenPage } from './pages/garden';

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
startRouter();

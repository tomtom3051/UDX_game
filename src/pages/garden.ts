import { GARDEN } from '../config';
import { drawPlant, plantCanvas } from '../garden/draw';
import {
  condition,
  decay,
  dryDays,
  dryLimit,
  isDead,
  isMature,
  needsWater,
  newPlant,
  nextPlotPrice,
  plantType,
  water,
  type Plant,
} from '../garden/logic';
import { garden, persistGarden, resetGarden, today } from '../garden/store';
import { navigate } from '../router';
import { muteButton, sfx } from '../sound';

function paintPlant(canvas: HTMLCanvasElement, plant: Plant, day: number, width: number): void {
  const type = plantType(plant.type);
  const ctx = plantCanvas(canvas, width);
  drawPlant(ctx, plant.type, plant.growth / type.growDays, decay(plant, day), isDead(plant, day), width, plant.lastWatered >= day);
}

export function gardenPage(root: HTMLElement): () => void {
  root.classList.add('garden');
  let toolsOpen = false;
  let resetArmed = false;
  /** Plot whose sheet is open, or null. */
  let openPlot: number | null = null;
  let renderedDay = today();

  function statusLine(day: number): string {
    const plants = garden.plots.filter((p): p is Plant => p !== null && !isDead(p, day));
    const thirsty = plants.filter((p) => needsWater(p, day)).length;
    if (plants.length === 0) return 'Tap an empty plot to plant your first seed.';
    if (thirsty === 0) return 'Everything is watered. See you tomorrow!';
    return `${thirsty} ${thirsty === 1 ? 'plant needs' : 'plants need'} water today.`;
  }

  function render(wateredPlot?: number): void {
    const day = today();
    renderedDay = day;
    const plotPrice = nextPlotPrice(garden.plots.length);

    root.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="back" aria-label="Back to hub">←</button>
        <h1>Garden</h1>
        <span class="money" title="Coins">🪙 <b>${garden.coins}</b></span>
        <span class="mute-slot"></span>
        <button class="icon-btn subtle" data-act="tools" aria-label="Presenter tools">⚙️</button>
      </header>

      <div class="tools ${toolsOpen ? '' : 'hidden'}">
        <span class="tools-title">Presenter tools</span>
        <button class="btn small" data-act="day">Next day <kbd>N</kbd></button>
        <button class="btn small" data-act="days3">Skip 3 days <kbd>J</kbd></button>
        <button class="btn small" data-act="coins">Add ${GARDEN.presenterCoins} coins <kbd>M</kbd></button>
        <button class="btn small danger" data-act="reset">${resetArmed ? 'Tap again to confirm' : 'Reset garden'}</button>
      </div>

      <div class="garden-status">
        <span class="day-chip">Day ${day - garden.startDay + 1}</span>
        <span>${statusLine(day)}</span>
      </div>

      <div class="plots">
        ${garden.plots
          .map((plant, i) => {
            if (!plant) return `<button class="plot empty" data-plot="${i}"><span class="plot-plus">＋</span><span class="plot-label">Plant a seed</span></button>`;
            const dead = isDead(plant, day);
            const thirsty = needsWater(plant, day);
            const ready = !dead && isMature(plant) && !plant.kept;
            return `
              <button class="plot ${dead ? 'dead' : ''} ${thirsty ? 'thirsty' : ''} ${i === wateredPlot ? 'splash' : ''}" data-plot="${i}">
                <canvas></canvas>
                ${plant.kept && !dead ? '<span class="plot-badge left">⭐</span>' : ''}
                ${ready ? '<span class="plot-badge left ready">✨</span>' : ''}
                ${thirsty ? '<span class="plot-badge drop">💧</span>' : ''}
                ${dead ? '<span class="plot-badge">🥀</span>' : ''}
                <span class="plot-label">${dead ? 'Dead' : isMature(plant) ? plantType(plant.type).name : `Day ${plant.growth} of ${plantType(plant.type).growDays}`}</span>
              </button>`;
          })
          .join('')}
        ${
          plotPrice === null
            ? ''
            : `<button class="plot locked ${garden.coins >= plotPrice ? 'affordable' : ''}" data-act="buy-plot">
                 <span class="plot-plus">🔒</span>
                 <span class="plot-label">New plot · 🪙 ${plotPrice}</span>
               </button>`
        }
      </div>
      <p class="footnote">Water each plant once a day. Skip too many days and it will not make it.</p>

      <div class="overlay hidden"></div>
    `;
    root.querySelector('.mute-slot')!.append(muteButton());
    root.querySelectorAll<HTMLElement>('.plot[data-plot]').forEach((el) => {
      const plant = garden.plots[Number(el.dataset.plot)];
      const canvas = el.querySelector('canvas');
      if (plant && canvas) paintPlant(canvas, plant, day, 96);
    });
    if (openPlot !== null) showSheet(openPlot);
  }

  // ------------------------------------------------------------ sheets

  function overlay(html: string): HTMLElement {
    const el = root.querySelector<HTMLElement>('.overlay')!;
    el.innerHTML = `<div class="sheet">${html}</div>`;
    el.classList.remove('hidden');
    return el;
  }

  function seedSheet(plot: number): void {
    const el = overlay(`
      <h2>Pick a seed</h2>
      <div class="seed-list">
        ${GARDEN.plants
          .map(
            (t) => `
          <button class="seed" data-seed="${t.id}" data-plot="${plot}" ${garden.coins < t.seedPrice ? 'disabled' : ''}>
            <canvas data-type="${t.id}"></canvas>
            <span class="seed-text">
              <b>${t.name}</b>
              <span>${t.blurb}</span>
              <span class="seed-stats">🌱 ${t.growDays} days · 🏜 ${t.dryLimit - 1} dry ${t.dryLimit - 1 === 1 ? 'day' : 'days'} ok · sells 🪙 ${t.sellPrice}</span>
            </span>
            <span class="seed-price">${t.seedPrice === 0 ? 'Free' : `🪙 ${t.seedPrice}`}</span>
          </button>`,
          )
          .join('')}
      </div>
      <button class="btn" data-act="close">Cancel</button>
    `);
    el.querySelectorAll<HTMLCanvasElement>('canvas[data-type]').forEach((c) => {
      drawPlant(plantCanvas(c, 52), c.dataset.type!, 1, 0, false, 52);
    });
  }

  function plantSheet(plot: number): void {
    const plant = garden.plots[plot]!;
    const day = today();
    const type = plantType(plant.type);
    const dead = isDead(plant, day);
    const mature = isMature(plant);
    const left = dryLimit(plant) - dryDays(plant, day);

    let info: string;
    if (dead) info = 'It went too long without water. Clear the plot to plant something new.';
    else if (plant.kept) info = `One of your keepers. It still needs water, but it is twice as tough: it survives ${dryLimit(plant) - 1} dry days.`;
    else if (mature) info = 'Fully grown! Keep it as decoration, or sell it to buy new seeds.';
    else info = `Watered ${plant.growth} of ${type.growDays} days. ${type.growDays - plant.growth} more to full bloom.`;

    let buttons: string;
    if (dead) buttons = `<button class="btn primary" data-do="clear">Clear plot</button>`;
    else if (mature) {
      buttons = `
        <button class="btn accent" data-do="sell">Sell for 🪙 ${type.sellPrice}</button>
        ${plant.kept ? '' : '<button class="btn primary" data-do="keep">Keep it ⭐</button>'}`;
    } else buttons = `<button class="btn danger" data-do="clear">Dig up</button>`;

    const el = overlay(`
      <h2>${type.name}</h2>
      <canvas class="sheet-plant"></canvas>
      <div class="plant-chips">
        <span class="chip ${condition(plant, day).toLowerCase()}">${condition(plant, day)}</span>
        ${dead ? '' : `<span class="chip">${plant.lastWatered >= day ? '💧 Watered today' : '💧 Needs water'}</span>`}
        ${dead || left > 99 ? '' : `<span class="chip">🏜 ${left - 1} dry ${left - 1 === 1 ? 'day' : 'days'} left</span>`}
      </div>
      <p class="sheet-text">${info}</p>
      ${buttons}
      <button class="btn" data-act="close">Close</button>
    `);
    paintPlant(el.querySelector('canvas')!, plant, day, 190);
  }

  function showSheet(plot: number): void {
    openPlot = plot;
    if (garden.plots[plot]) plantSheet(plot);
    else seedSheet(plot);
  }

  // ------------------------------------------------------------ actions

  function tapPlot(plot: number): void {
    const plant = garden.plots[plot];
    if (plant && water(plant, today())) {
      persistGarden();
      sfx.water();
      navigator.vibrate?.(10);
      render(plot);
      return;
    }
    sfx.click();
    showSheet(plot);
  }

  function act(action: string): void {
    if (action === 'back') {
      sfx.click();
      navigate('/');
      return;
    }
    if (action === 'close') openPlot = null;
    if (action === 'tools') toolsOpen = !toolsOpen;
    if (action === 'day') garden.dayOffset += 1;
    if (action === 'days3') garden.dayOffset += 3;
    if (action === 'coins') {
      garden.coins += GARDEN.presenterCoins;
      sfx.buy();
    }
    if (action === 'buy-plot') {
      const price = nextPlotPrice(garden.plots.length);
      if (price === null || garden.coins < price) {
        sfx.deny();
        return;
      }
      garden.coins -= price;
      garden.plots.push(null);
      sfx.buy();
    }
    if (action === 'reset') {
      if (resetArmed) resetGarden();
      resetArmed = !resetArmed;
    } else {
      resetArmed = false;
    }
    persistGarden();
    render();
  }

  function onClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-seed],[data-do],[data-act],[data-plot]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    const d = target.dataset;
    if (d.seed) {
      const type = plantType(d.seed);
      if (garden.coins < type.seedPrice) return;
      garden.coins -= type.seedPrice;
      garden.plots[Number(d.plot)] = newPlant(type.id, today());
      openPlot = null;
      sfx.dab();
    } else if (d.do && openPlot !== null) {
      const plant = garden.plots[openPlot];
      if (!plant) return;
      if (d.do === 'sell') {
        garden.coins += plantType(plant.type).sellPrice;
        garden.plots[openPlot] = null;
        sfx.buy();
      } else if (d.do === 'keep') {
        plant.kept = true;
        sfx.win();
      } else if (d.do === 'clear') {
        garden.plots[openPlot] = null;
        sfx.click();
      }
      openPlot = null;
    } else if (d.act) {
      act(d.act);
      return;
    } else if (d.plot) {
      tapPlot(Number(d.plot));
      return;
    }
    persistGarden();
    render();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'n') act('day');
    if (key === 'j') act('days3');
    if (key === 'm') act('coins');
  }

  // A new day can start while the garden is open.
  const timer = window.setInterval(() => {
    if (today() !== renderedDay) render();
  }, 20000);

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  render();

  return () => {
    window.clearInterval(timer);
    window.removeEventListener('keydown', onKey);
  };
}

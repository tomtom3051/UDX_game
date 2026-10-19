import {
  MAPS,
  PRESENTER_MONEY,
  SPEED_TIERS,
  TIER_PRICES,
  WIDTH_TIERS,
  type MapDef,
} from '../config';
import { isPass } from '../grading';
import { navigate } from '../router';
import { muteButton, sfx } from '../sound';
import { breakBannerHtml, ensureSession, isOnBreak, onPhaseChange, sessionStripHtml } from '../session';
import { persistSettings, settings } from '../settings';
import { persist, resetProgress, save } from '../state';

type UpgradeKey = 'speedTier' | 'widthTier';

const UPGRADES: { key: UpgradeKey; name: string; icon: string; unit: string; values: number[] }[] = [
  { key: 'speedTier', name: 'Speed', icon: '⚡', unit: 'px/s', values: SPEED_TIERS },
  { key: 'widthTier', name: 'Mowing width', icon: '↔️', unit: 'px', values: WIDTH_TIERS },
];

function isUnlocked(map: MapDef): boolean {
  return !map.requires || isPass(save.best[map.requires]);
}

/** Map size shown in metres, purely for flavour (40 px = 1 m). */
function sizeLabel(map: MapDef): string {
  return `${Math.round(map.width / 40)} × ${Math.round(map.height / 40)} m`;
}

export function basePage(root: HTMLElement): () => void {
  root.classList.add('base');
  let resetArmed = false;
  let toolsOpen = false;

  function render(): void {
    const cooling = isOnBreak();
    root.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="back" aria-label="Back to hub">←</button>
        <h1>Lawn Mower</h1>
        <span class="money" title="Money">💰 <b>${save.money}</b></span>
        <span class="mute-slot"></span>
        <button class="icon-btn subtle" data-act="tools" aria-label="Presenter tools">⚙️</button>
      </header>

      <div class="tools ${toolsOpen ? '' : 'hidden'}">
        <span class="tools-title">Presenter tools</span>
        <button class="btn small" data-act="money">Add ${PRESENTER_MONEY} money <kbd>M</kbd></button>
        <button class="btn small danger" data-act="reset">${resetArmed ? 'Tap again to confirm' : 'Reset all progress'}</button>
      </div>

      ${sessionStripHtml()}
      ${breakBannerHtml('You can still look around and use the shop, but jobs open again after the break.')}

      <label class="toggle-row timer-toggle">
        <span><b>Job timer</b><small>${settings.lawnTimer ? 'Beat the clock for a time bonus.' : 'Relaxed: no clock, take as long as you like.'}</small></span>
        <input type="checkbox" data-timer ${settings.lawnTimer ? 'checked' : ''} />
      </label>

      <h2 class="section-title">Job board</h2>
      <div class="jobs">
        ${MAPS.map((map) => {
          const unlocked = isUnlocked(map);
          const best = save.best[map.id];
          const required = MAPS.find((m) => m.id === map.requires);
          return `
          <div class="job-card ${unlocked ? '' : 'locked'}">
            <div class="job-top">
              <span class="job-icon">${unlocked ? map.icon : '🔒'}</span>
              <div class="job-title">
                <b>${map.name}</b>
                <span>${map.blurb}</span>
              </div>
              <span class="grade-chip ${best ? `grade-${best}` : 'grade-none'}" title="Best grade">${best ?? '–'}</span>
            </div>
            <div class="job-stats">
              <span>📐 ${sizeLabel(map)}</span>
              <span>⏱ ${settings.lawnTimer ? `${map.timeLimit} s` : 'No limit'}</span>
              <span>💰 ${map.basePayout}</span>
            </div>
            <div class="job-bottom">
              <span class="job-gear">Recommended: ${map.recommended}</span>
              ${
                unlocked
                  ? `<button class="btn primary small job-start" data-map="${map.id}" ${cooling ? 'disabled' : ''}>${cooling ? 'On a break' : 'Start job'}</button>`
                  : `<span class="job-lock">Pass ${required?.name ?? 'the previous job'} first</span>`
              }
            </div>
          </div>`;
        }).join('')}
      </div>

      <button class="btn race" disabled>🏁 Online race <span>coming soon</span></button>

      <h2 class="section-title">Upgrade shop</h2>
      <div class="shop">
        ${UPGRADES.map((u) => {
          const tier = save[u.key];
          const maxed = tier >= u.values.length - 1;
          const price = maxed ? 0 : TIER_PRICES[tier + 1];
          return `
          <div class="shop-card">
            <div class="shop-head">
              <span class="shop-icon">${u.icon}</span>
              <b>${u.name}</b>
            </div>
            <div class="pips">${u.values
              .slice(1)
              .map((_, i) => `<i class="${i < tier ? 'on' : ''}"></i>`)
              .join('')}</div>
            <p class="shop-effect">${
              maxed
                ? `${u.values[tier]} ${u.unit} · maxed out`
                : `${u.values[tier]} → <b>${u.values[tier + 1]}</b> ${u.unit}`
            }</p>
            <button class="btn accent small" data-buy="${u.key}" ${maxed || save.money < price ? 'disabled' : ''}>
              ${maxed ? 'Max tier' : `Buy tier ${tier + 1} · 💰 ${price}`}
            </button>
          </div>`;
        }).join('')}
      </div>
    `;
    root.querySelector('.mute-slot')!.append(muteButton());
  }

  function act(action: string): void {
    if (action === 'back') {
      sfx.click();
      navigate('/');
      return;
    }
    if (action === 'tools') toolsOpen = !toolsOpen;
    if (action === 'money') {
      save.money += PRESENTER_MONEY;
      persist();
      sfx.buy();
    }
    if (action === 'reset') {
      if (resetArmed) resetProgress();
      resetArmed = !resetArmed;
    } else {
      resetArmed = false;
    }
    render();
  }

  function onClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-map],[data-buy]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.act) {
      act(target.dataset.act);
    } else if (target.dataset.map) {
      sfx.click();
      navigate(`/lawn/play/${target.dataset.map}`);
    } else if (target.dataset.buy) {
      const key = target.dataset.buy as UpgradeKey;
      const price = TIER_PRICES[save[key] + 1];
      if (price === undefined || save.money < price) {
        sfx.deny();
        return;
      }
      save.money -= price;
      save[key]++;
      persist();
      sfx.buy();
      render();
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'm') act('money');
  }

  // Entering the game starts the shared play session; re-render when it starts or ends.
  const stopListening = onPhaseChange(() => render());
  ensureSession();

  root.addEventListener('click', onClick);
  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.timer === undefined) return;
    settings.lawnTimer = input.checked;
    persistSettings();
    sfx.click();
    render();
  });
  window.addEventListener('keydown', onKey);
  render();

  return () => {
    stopListening();
    window.removeEventListener('keydown', onKey);
  };
}

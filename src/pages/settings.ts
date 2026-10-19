import { THEMES } from '../config';
import { navigate } from '../router';
import { endSessionNow, onPhaseChange, skipBreak, status } from '../session';
import { applyTheme, persistSettings, settings } from '../settings';
import { setEffects, setMusic, sfx } from '../sound';
import { toast } from '../ui';

export function settingsPage(root: HTMLElement): () => void {
  root.classList.add('settings');

  function render(): void {
    const phase = status().phase;
    root.innerHTML = `
      <header class="bar">
        <button class="icon-btn" data-act="back" aria-label="Back to hub">←</button>
        <h1>Settings</h1>
      </header>

      <h2 class="section-title">Sound</h2>
      <div class="settings-card">
        <label class="toggle-row">
          <span><b>Music</b><small>Calm background music</small></span>
          <input type="checkbox" data-toggle="music" ${settings.music ? 'checked' : ''} />
        </label>
        <label class="toggle-row">
          <span><b>Sound effects</b><small>Taps, mower engine, pottery wheel</small></span>
          <input type="checkbox" data-toggle="effects" ${settings.effects ? 'checked' : ''} />
        </label>
      </div>

      <h2 class="section-title">Games</h2>
      <div class="settings-card">
        <label class="toggle-row">
          <span><b>Lawn Mower job timer</b><small>Off is relaxed mode: no clock, no time pressure</small></span>
          <input type="checkbox" data-toggle="lawnTimer" ${settings.lawnTimer ? 'checked' : ''} />
        </label>
      </div>

      <h2 class="section-title">Colours</h2>
      <div class="settings-card">
        <div class="theme-grid">
          ${THEMES.map(
            (t) => `
            <button class="theme-option ${settings.theme === t.id ? 'on' : ''}" data-theme="${t.id}">
              <span class="theme-swatch" style="background:${t.accent}; box-shadow: inset 0 0 0 6px ${t.background}"></span>
              ${t.name}
            </button>`,
          ).join('')}
          <label class="theme-option ${settings.theme === 'custom' ? 'on' : ''}">
            <span class="theme-swatch custom" style="background:${settings.customAccent}">
              <input type="color" data-custom value="${settings.customAccent}" aria-label="Pick your own colour" />
            </span>
            Your own
          </label>
        </div>
        <p class="settings-note">Pick a theme, or tap "Your own" to choose any colour.</p>
      </div>

      <details class="presenter" ${phase === 'none' ? '' : 'open'}>
        <summary>Presenter tools</summary>
        <div class="settings-card">
          <p class="settings-note">Play session: <b>${{ playing: 'running', overtime: 'finishing a game', break: 'on a break', none: 'not started' }[phase]}</b></p>
          <div class="presenter-buttons">
            <button class="btn small" data-act="end">End play time now</button>
            <button class="btn small" data-act="skip">Skip break <kbd>K</kbd></button>
          </div>
          <label class="toggle-row">
            <span><b>Fast timers</b><small>1 minute of play, 30 second break, for testing</small></span>
            <input type="checkbox" data-toggle="fast" ${settings.fastTimers ? 'checked' : ''} />
          </label>
        </div>
      </details>
    `;
  }

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-theme]');
    if (!target) return;
    const { act, theme } = target.dataset;
    sfx.click();
    if (act === 'back') {
      navigate('/');
      return;
    }
    if (act === 'end') {
      endSessionNow();
      toast('Play time ended. Lawn Mower and Pottery are now on a break.');
    }
    if (act === 'skip') {
      skipBreak();
      toast('Break skipped.');
    }
    if (theme) {
      settings.theme = theme;
      persistSettings();
      applyTheme();
    }
    render();
  });

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const toggle = input.dataset.toggle;
    if (toggle === 'music') setMusic(input.checked);
    if (toggle === 'effects') setEffects(input.checked);
    if (toggle === 'lawnTimer') {
      settings.lawnTimer = input.checked;
      persistSettings();
    }
    if (toggle === 'fast') {
      settings.fastTimers = input.checked;
      persistSettings();
    }
    sfx.click();
  });

  // Live preview while dragging in the colour picker.
  root.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.custom === undefined) return;
    settings.theme = 'custom';
    settings.customAccent = input.value;
    persistSettings();
    applyTheme();
    root.querySelectorAll('.theme-option').forEach((el) => el.classList.toggle('on', el.contains(input)));
    (input.parentElement as HTMLElement).style.background = input.value;
  });

  const stopListening = onPhaseChange(() => render());
  render();
  return stopListening;
}

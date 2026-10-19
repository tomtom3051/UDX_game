import { APP, MINIGAMES, SESSION } from '../config';
import { navigate } from '../router';
import { breakBannerHtml, isOnBreak, onPhaseChange, sessionStripHtml } from '../session';
import { muteButton, sfx } from '../sound';

export function hubPage(root: HTMLElement): () => void {
  root.classList.add('hub');

  function render(): void {
    const resting = isOnBreak();
    root.innerHTML = `
      <header class="hub-header">
        <div>
          <h1>${APP.title}</h1>
          <p class="tagline">${APP.tagline}</p>
        </div>
        <div class="hub-actions">
          <span class="mute-slot"></span>
          <button class="icon-btn" data-settings aria-label="Settings">⚙️</button>
        </div>
      </header>
      ${sessionStripHtml()}
      ${breakBannerHtml('Lawn Mower and Pottery open again after the break. The garden is always open.')}
      <h2 class="section-title">Pick a minigame</h2>
      <div class="game-grid">
        ${MINIGAMES.map((g) => {
          const onBreak = resting && SESSION.timedGames.includes(g.id);
          const badge = !g.playable
            ? '<span class="badge badge-soon">Coming soon</span>'
            : onBreak
              ? '<span class="badge badge-break">On a break</span>'
              : '<span class="badge badge-play">Play now</span>';
          return `
          <button class="game-card ${g.playable ? 'playable' : ''}" data-id="${g.id}">
            <span class="game-icon" style="background:${g.colour}">${g.icon}</span>
            <span class="game-text">
              <span class="game-name">${g.name}</span>
              <span class="game-desc">${g.description}</span>
            </span>
            ${badge}
          </button>`;
        }).join('')}
      </div>
      <p class="footnote">Course project demo</p>
    `;
    root.querySelector('.mute-slot')!.append(muteButton());
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-settings]')) {
      sfx.click();
      navigate('/settings');
      return;
    }
    const card = target.closest<HTMLElement>('.game-card');
    if (!card) return;
    sfx.click();
    const game = MINIGAMES.find((g) => g.id === card.dataset.id)!;
    navigate(game.playable && game.route ? game.route : `/wip/${game.id}`);
  });

  const stopListening = onPhaseChange(() => render());
  render();
  return stopListening;
}

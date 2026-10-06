import { APP, MINIGAMES } from '../config';
import { navigate } from '../router';
import { muteButton, sfx } from '../sound';

export function hubPage(root: HTMLElement): void {
  root.classList.add('hub');
  root.innerHTML = `
    <header class="hub-header">
      <div>
        <h1>${APP.title}</h1>
        <p class="tagline">${APP.tagline}</p>
      </div>
      <span class="mute-slot"></span>
    </header>
    <h2 class="section-title">Pick a minigame</h2>
    <div class="game-grid">
      ${MINIGAMES.map(
        (g) => `
        <button class="game-card ${g.playable ? 'playable' : ''}" data-id="${g.id}">
          <span class="game-icon" style="background:${g.colour}">${g.icon}</span>
          <span class="game-text">
            <span class="game-name">${g.name}</span>
            <span class="game-desc">${g.description}</span>
          </span>
          <span class="badge ${g.playable ? 'badge-play' : 'badge-soon'}">${g.playable ? 'Play now' : 'Coming soon'}</span>
        </button>`,
      ).join('')}
    </div>
    <p class="footnote">Course project demo</p>
  `;
  root.querySelector('.mute-slot')!.append(muteButton());

  root.querySelectorAll<HTMLButtonElement>('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      sfx.click();
      const game = MINIGAMES.find((g) => g.id === card.dataset.id)!;
      navigate(game.playable ? '/lawn' : `/wip/${game.id}`);
    });
  });
}

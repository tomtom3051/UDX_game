import { MINIGAMES } from '../config';
import { navigate } from '../router';
import { sfx } from '../sound';

export function wipPage(root: HTMLElement, [id]: string[]): void {
  const game = MINIGAMES.find((g) => g.id === id);
  if (!game) {
    navigate('/', true);
    return;
  }
  root.classList.add('wip');
  root.innerHTML = `
    <header class="bar">
      <button class="icon-btn back" aria-label="Back to hub">←</button>
    </header>
    <div class="wip-body">
      <span class="game-icon big" style="background:${game.colour}">${game.icon}</span>
      <h1>${game.name}</h1>
      <span class="badge badge-soon">Work in progress</span>
      <p>This minigame is still in development. We are busy building it, so check back soon.</p>
      <div class="wip-cones">🚧</div>
      <button class="btn primary back">Back to the hub</button>
    </div>
  `;
  root.querySelectorAll('.back').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      navigate('/');
    }),
  );
}

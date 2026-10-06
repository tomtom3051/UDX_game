// Tiny hash router. A page renders into the given element and may return a cleanup function.
export type Page = (root: HTMLElement, params: string[]) => void | (() => void);

const routes: [RegExp, Page][] = [];
let cleanup: (() => void) | void;

export function route(pattern: RegExp, page: Page): void {
  routes.push([pattern, page]);
}

export function navigate(path: string, replace = false): void {
  if (replace) location.replace(`#${path}`);
  else location.hash = path;
}

function render(): void {
  const path = location.hash.replace(/^#/, '') || '/';
  const app = document.getElementById('app')!;
  cleanup?.();
  cleanup = undefined;
  for (const [pattern, page] of routes) {
    const match = path.match(pattern);
    if (!match) continue;
    const el = document.createElement('div');
    el.className = 'page';
    app.replaceChildren(el);
    cleanup = page(el, match.slice(1));
    return;
  }
  navigate('/', true);
}

export function startRouter(): void {
  window.addEventListener('hashchange', render);
  render();
}

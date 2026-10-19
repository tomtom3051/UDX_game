// Small shared UI helpers that live outside the pages.

let toastTimer = 0;

/** Shows a short message at the top of the phone screen. */
export function toast(text: string, ms = 4000): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

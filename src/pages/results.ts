import { getMap } from '../config';
import { navigate } from '../router';
import { sfx } from '../sound';
import { isOnBreak } from '../session';
import { lastReport } from '../state';

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function resultsPage(root: HTMLElement): void {
  const report = lastReport;
  const map = report && getMap(report.mapId);
  if (!report || !map) {
    navigate('/lawn', true);
    return;
  }

  let headline = report.passed ? 'Job done!' : 'Job failed';
  let message = report.passed
    ? 'The garden looks great. Your pay is in the bank.'
    : 'Less than 80% of the lawn was mowed, so the customer will not pay.';
  if (report.reason === 'pool') {
    headline = 'Splash!';
    message = 'You drove into the pool! Job failed.';
  } else if (report.reason === 'quit') {
    message = 'You left the job early, so there is no pay.';
  } else if (!report.passed && report.coverage >= 80) {
    message = 'Too many flower beds were destroyed, so the customer will not pay.';
  }

  root.classList.add('results');
  root.innerHTML = `
    <div class="results-body ${report.reason === 'pool' ? 'pool' : ''}">
      <p class="results-map">${map.icon} ${map.name}</p>
      <h1>${headline}</h1>
      <div class="grade-big grade-${report.grade}">${report.grade}</div>
      <p class="results-message">${message}</p>
      <div class="stats">
        <div><span>Lawn mowed</span><b>${report.coverage.toFixed(1)}%</b></div>
        <div><span>Flower beds destroyed</span><b>${report.bedsDestroyed}</b></div>
        <div><span>${report.relaxed ? 'Job timer' : 'Time remaining'}</span><b>${report.relaxed ? 'Off (relaxed)' : formatClock(report.timeLeft)}</b></div>
        <div><span>Final score</span><b>${report.score.toFixed(1)}</b></div>
        <div class="payout"><span>Payout</span><b>💰 ${report.payout}</b></div>
      </div>
      ${isOnBreak() ? '<p class="results-break">☕ Your play time is up. Time for a break before the next job.</p>' : ''}
      <button class="btn primary" id="to-base">Back to base</button>
    </div>
  `;
  root.querySelector('#to-base')!.addEventListener('click', () => {
    sfx.click();
    navigate('/lawn', true);
  });

  if (report.passed) sfx.win();
  else sfx.lose();
}

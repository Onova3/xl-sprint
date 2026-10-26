/* Petites animations en JavaScript (les autres sont en CSS, dans polish.css). */

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Fait défiler les chiffres des statistiques de 0 jusqu'à leur valeur, sans changer leur format final. */
export function countUp(root: ParentNode, selector = '.stat .v', ms = 700): void {
  if (reduced()) return;
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const final = el.textContent ?? '';
    const m = /^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(final);
    if (!m) return;
    const [, pre, num, post] = m;
    const comma = num.includes(',');
    const decimals = (num.split(/[.,]/)[1] ?? '').length;
    const target = Number(num.replace(',', '.'));
    if (!Number.isFinite(target) || target === 0) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      let s = (target * eased).toFixed(decimals);
      if (comma) s = s.replace('.', ',');
      el.textContent = p < 1 ? pre + s + post : final;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

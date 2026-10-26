/* Petits outils DOM, repris de la v1.1. */

export const $ = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = document): T =>
  el.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, el: ParentNode = document): T[] =>
  [...el.querySelectorAll(s)] as T[];
export const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
export const now = (): number => performance.now();
export const fmtClock = (ms: number): string => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0');
};
export function keysHtml(labels: string[], seq: boolean): string {
  return (
    '<span class="keys">' +
    labels
      .map((l) => '<kbd>' + esc(l) + '</kbd>')
      .join(seq ? '<span class="then">›</span>' : '<span class="plus">+</span>') +
    '</span>'
  );
}
export function copyText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text);
  } catch (e) {
    return Promise.reject(e);
  }
}

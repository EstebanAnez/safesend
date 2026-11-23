/**
 * Spread on the element a panel wants focused when it replaces another one
 * (usually its heading). DemoJourney moves focus there after user actions, so
 * keyboard and screen-reader users land on the new content (WCAG 2.4.3).
 */
export const FOCUS_ON_SHOW = { 'data-focus-on-show': true, tabIndex: -1 } as const;

export const FOCUS_ON_SHOW_SELECTOR = '[data-focus-on-show]';

/**
 * Focus the FOCUS_ON_SHOW element inside `container`. Panels are code-split,
 * so the element may not exist yet: wait for it (up to `timeoutMs`) instead of
 * leaving focus on <body>. Returns a cleanup function.
 */
export function focusWhenShown(container: HTMLElement | null, timeoutMs = 3000): () => void {
  if (!container) return () => undefined;
  const find = () => container.querySelector<HTMLElement>(FOCUS_ON_SHOW_SELECTOR);
  const now = find();
  if (now) {
    now.focus();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    const el = find();
    if (!el) return;
    el.focus();
    stop();
  });
  const timer = setTimeout(() => stop(), timeoutMs);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
  }
  observer.observe(container, { childList: true, subtree: true });
  return stop;
}

import { expect, test } from '@playwright/test';

const tabs = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

test('F1–F6 cabem em 1920×1080 sem rolagem, vazamento ou texto truncado sem tooltip', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  for (const key of tabs) {
    await page.getByRole('tab', { name: new RegExp(`^${key}`) }).click();
    await page.waitForTimeout(250);

    const audit = await page.evaluate(() => {
      const main = document.querySelector('main');
      const cards = [...document.querySelectorAll<HTMLElement>('[data-layout-card]')];
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const overflows = cards.flatMap((card, cardIndex) => {
        const bounds = card.getBoundingClientRect();
        return [...card.querySelectorAll<HTMLElement>('*')].filter((element) => {
          if (!visible(element)) return false;
          if (element.closest('[data-layout-card]') !== card) return false;
          if (getComputedStyle(element).position === 'fixed') return false;
          const rect = element.getBoundingClientRect();
          return rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1;
        }).slice(0, 12).map((element) => ({
          cardIndex,
          tag: element.tagName,
          text: element.innerText?.trim().slice(0, 80),
          className: typeof element.className === 'string' ? element.className : '',
        }));
      });
      const internalScroll = cards.filter((card) => card.scrollHeight > card.clientHeight + 1).map((card) => ({
        title: card.querySelector('h2')?.textContent?.trim() ?? '(card sem título)',
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
      }));
      const truncated = [...(main?.querySelectorAll<HTMLElement>('*') ?? [])].filter((element) => {
        if (!visible(element) || !element.textContent?.trim()) return false;
        if (element.classList.contains('sr-only')) return false;
        const style = getComputedStyle(element);
        const isEllipsis = style.textOverflow === 'ellipsis' || (style.whiteSpace === 'nowrap' && ['hidden', 'clip'].includes(style.overflowX));
        if (!isEllipsis || element.scrollWidth <= element.clientWidth + 1) return false;
        if (element.title || element.getAttribute('aria-label') || element.getAttribute('aria-describedby')) return false;
        return true;
      }).slice(0, 20).map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 80),
        className: typeof element.className === 'string' ? element.className : '',
      }));

      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        mainHeight: main?.clientHeight ?? 0,
        mainScrollHeight: main?.scrollHeight ?? 0,
        internalScroll,
        overflows,
        truncated,
      };
    });

    expect(audit.documentHeight, `${key}: rolagem vertical da página`).toBeLessThanOrEqual(audit.viewportHeight);
    expect(audit.mainScrollHeight, `${key}: rolagem vertical na área da tela`).toBeLessThanOrEqual(audit.mainHeight + 1);
    expect(audit.internalScroll, `${key}: rolagem interna em card`).toEqual([]);
    expect(audit.overflows, `${key}: conteúdo fora do card`).toEqual([]);
    expect(audit.truncated, `${key}: texto truncado sem tooltip`).toEqual([]);
  }
});

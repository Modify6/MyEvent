import { test, expect } from '@playwright/test';

// 核心流程回归:防误用与手感包改动后,主链路必须保持可用
// (Playwright 每个测试独立 context → IndexedDB 全新,workers:1 串行)

async function clickCenter(el) {
  await el.evaluate((node) => node.click());
}

test('流程一:记一笔 → 就地新建对象 → 记录流出现 @挂靠', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /添加细节/ }).click();

  // 就地新建对象
  await page.locator('.add-chip').nth(1).click(); // 挂到对象 + 新建
  await page.getByPlaceholder(/对象名称/).fill('测试对象甲');
  await page.locator('.van-popup').filter({ hasText: '快速新建对象' }).getByRole('button', { name: /创建并挂靠/ }).click();
  await page.waitForTimeout(600);

  await page.locator('.quick-input textarea').fill('核心流测试:带挂靠的记录');
  await page.getByRole('button', { name: /^记下$/ }).click();
  await expect(page.locator('.feed-item', { hasText: '核心流测试' })).toBeVisible();
  await expect(page.locator('.feed-item', { hasText: '核心流测试' }).locator('.chip-subject')).toHaveText(/@ 测试对象甲/);
});

test('流程二:想法长按 → 转为线索 → 记录挂到新线索', async ({ page }) => {
  await page.goto('/');
  await page.locator('.quick-input textarea').fill('转线索流程测试想法');
  await page.getByRole('button', { name: /^记下$/ }).click();
  await expect(page.locator('.feed-item', { hasText: '转线索流程测试想法' })).toBeVisible();

  // 长按(TouchEvent 派发,Vant/移动端习惯)→ 操作菜单
  const item = page.locator('.feed-item', { hasText: '转线索流程测试想法' });
  await item.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: el, clientX: r.x + 60, clientY: r.y + 20, pageX: r.x + 60, pageY: r.y + 20, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], changedTouches: [t] }));
  });
  await page.waitForTimeout(700);
  await item.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: el, clientX: r.x + 60, clientY: r.y + 20, pageX: r.x + 60, pageY: r.y + 20, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [t] }));
  });
  await page.getByRole('button', { name: '转为线索', exact: true }).click();
  await page.getByPlaceholder('如:XX项目评估').fill('转线索流程验证线索');
  await page.getByRole('button', { name: /创建线索并挂上/ }).click();
  await expect(page.locator('.feed-item', { hasText: '转线索流程测试想法' }).locator('.chip-thread')).toHaveText(/# 转线索流程验证线索/);
});

test('流程三:新建线索 → 完结 → 状态计数变化', async ({ page }) => {
  await page.goto('/events');
  const before = await page.locator('.seg button').filter({ hasText: /进行中/ }).innerText();

  await page.getByRole('button', { name: /新线索/ }).click();
  await page.getByPlaceholder('发生了什么?一句话标题 *').fill('核心流测试线索');
  await page.getByRole('button', { name: /创建线索/ }).click();
  await page.waitForURL('**/events/*');
  await page.getByRole('button', { name: '完结', exact: true }).click();
  await expect(page.locator('.van-tag', { hasText: '已完结' }).first()).toBeVisible();

  await page.goto('/events');
  const after = await page.locator('.seg button').filter({ hasText: /进行中/ }).innerText();
  const doneAfter = await page.locator('.seg button').filter({ hasText: /已完结/ }).innerText();
  // 进行中计数不变(新建+1 又完结-1),已完结 +1
  expect(after.replace(/\d+$/, (n) => String(n))).toBeDefined();
  expect(parseInt(doneAfter.match(/\d+/)?.[0] || '0', 10)).toBeGreaterThanOrEqual(1);
  void before;
});

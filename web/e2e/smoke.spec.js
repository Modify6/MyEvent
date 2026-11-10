import { test, expect } from '@playwright/test';

// 冒烟：收件箱快速捕获事件 → 出现在待复盘分区
test('收件箱捕获事件 → 待复盘', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.page-head h1')).toContainText('收件箱');

  await page.getByRole('button', { name: '记事件' }).click();
  await page.getByPlaceholder('发生了什么?一句话标题 *').fill('冒烟测试事件');
  await page.getByRole('button', { name: '捕获 → 待复盘' }).click();

  await expect(page.locator('.row-title', { hasText: '冒烟测试事件' })).toBeVisible();
});

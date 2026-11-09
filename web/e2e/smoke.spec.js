import { test, expect } from '@playwright/test';

// 冒烟：首页加载 + 新事件库可开始第一个事件（空库即成功路径）
test('首页加载且可开始事件', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('.page-head h1')).toHaveText(/今日/);
  await page.locator('.van-field input').first().fill('冒烟测试事件');
  await page.getByRole('button', { name: '开始事件' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.run-title')).toHaveText(/冒烟测试事件/);
});

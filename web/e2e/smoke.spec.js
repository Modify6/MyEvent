import { test, expect } from '@playwright/test';

// 冒烟：记录流首页 3 秒随手记 → 出现在时间线
test('记录流随手记 → 时间线出现', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.page-head h1')).toContainText('记录');

  await page.locator('.quick-input textarea').fill('冒烟测试:随手记一句');
  await page.getByRole('button', { name: /记下/ }).click();

  await expect(page.locator('.feed-text', { hasText: '冒烟测试:随手记一句' })).toBeVisible();
});

import {expect,test} from '@playwright/test';

test('registers, records a completed sale, exports data and deletes the account',async({page})=>{
  const stamp=Date.now(),email=`e2e-${stamp}@example.com`,password=`secure-password-${stamp}`,item=`E2E Amulet ${stamp}`;
  await page.goto('/');await expect(page.getByRole('heading',{name:/Create your Exile workspace|Welcome back, Exile/})).toBeVisible();
  if(await page.getByRole('button',{name:'Create an account'}).isVisible())await page.getByRole('button',{name:'Create an account'}).click();
  await page.getByLabel('Name').fill('E2E Exile');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Create account'}).click();
  await expect(page.getByLabel('Exile Companion home')).toBeVisible();await page.reload();await expect(page.getByLabel('Exile Companion home')).toBeVisible();
  await page.goto('/sales');await page.getByLabel('Sale item name').fill(item);await page.getByLabel('Sale listing price').fill('17');await page.getByRole('button',{name:'Add listing'}).click();
  const card=page.getByRole('heading',{name:item}).locator('..').locator('..');await expect(card).toContainText('17 exalted');await card.getByTitle('Mark sold').click();await expect(card).toContainText('sold for 17');
  await page.goto('/settings');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export account'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('exile-companion-account.json');
  await page.getByLabel('Password for account deletion').fill(password);await page.getByLabel('Account deletion confirmation').fill('DELETE MY ACCOUNT');await page.getByRole('button',{name:'Delete permanently'}).click();await expect(page.getByRole('heading',{name:'Welcome back, Exile'})).toBeVisible();
});

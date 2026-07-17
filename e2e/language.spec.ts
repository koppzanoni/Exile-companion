import {expect,test} from '@playwright/test';

test('visitor changes language immediately and keeps the explicit choice after reload',async({page})=>{
  await page.goto('/');
  const selector=page.getByRole('banner').getByRole('combobox',{name:'Language'});
  await selector.selectOption('pt-BR');
  await expect(page.getByRole('link',{name:'Configurações'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','pt-BR');
  await page.reload();
  await expect(page.getByRole('banner').getByRole('combobox',{name:'Idioma'})).toHaveValue('pt-BR');
  await expect(page.locator('html')).toHaveAttribute('lang','pt-BR');
});

test('Portuguese shell and language selector do not overflow a mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/settings');
  await page.getByRole('banner').getByRole('combobox',{name:'Language'}).selectOption('pt-BR');
  await expect(page.getByRole('heading',{name:'Configurações'})).toBeVisible();
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});

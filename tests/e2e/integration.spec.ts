import { expect, test } from '@playwright/test'

test('validates the cart coupon through the API and keeps the accepted total', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'expired-coupon' }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
  })

  await page.goto('/cart')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
  await page.locator('input[placeholder="Digite o código promocional..."]:visible').fill('JUNGLE10')
  await page.getByRole('button', { name: 'Aplicar' }).filter({ visible: true }).click()
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('Este cupom expirou.')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
})

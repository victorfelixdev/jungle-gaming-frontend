import { expect, test, type Page } from '@playwright/test'

async function resetFixture(page: Page) {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/scenario', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'default' }),
    })
  })
}

async function prepareCart(page: Page) {
  await resetFixture(page)
  await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
  })
}

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images]
      .filter((image) => {
        const rect = image.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
      })
      .map((image) => image.decode().catch(() => undefined)))
  })
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01,
  })
}

test('home visual baseline', async ({ page }) => {
  await resetFixture(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()
  await capture(page, 'home.png')
})

test('NFT detail visual baseline', async ({ page }) => {
  await resetFixture(page)
  await page.goto('/nft/nft-aurora')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await capture(page, 'nft-detail.png')
})

test('cart visual baseline', async ({ page }) => {
  await prepareCart(page)
  await page.goto('/cart')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
  await capture(page, 'cart.png')
})

test('checkout visual baseline', async ({ page }) => {
  await prepareCart(page)
  await page.goto('/checkout')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
  await capture(page, 'checkout.png')
})

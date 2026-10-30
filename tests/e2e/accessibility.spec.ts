import { expect, test } from '@playwright/test'

test('keeps keyboard focus inside the desktop login dialog and restores it on close', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, 'O login mobile usa uma página própria.')
  await page.goto('/')
  const open = page.getByRole('button', { name: 'Abrir login' })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Entrar' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('closes the enlarged NFT image with Escape and restores focus', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, 'A galeria ampliada aparece no desktop.')
  await page.goto('/nft/nft-aurora')
  const open = page.getByRole('button', { name: 'Ampliar imagem do NFT' })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Imagem ampliada de Emerald Ape #042' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar imagem ampliada' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('combines mobile filters and restores focus when closing the panel', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, 'O painel de filtros aparece no mobile.')
  await page.goto('/')
  const open = page.getByRole('button', { name: 'Abrir filtros' })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Arte digital/ }).click()
  await expect(page).toHaveURL(/categories/)
  await dialog.getByRole('button', { name: /Polygon/ }).click()
  await expect(page).toHaveURL(/networks/)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('does not overflow horizontally at required widths', async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/nft/nft-aurora', '/cart']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      const { documentWidth, viewportWidth } = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
      expect(documentWidth, `${route} em ${width}px`).toBeLessThanOrEqual(viewportWidth)
    }
  }
})

test('stops skeleton animation for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/scenario', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'slow' }),
    })
  })
  await page.goto('/')
  const skeleton = page.locator('.shimmer').first()
  await expect(skeleton).toBeVisible()
  expect(await skeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
})

test('keeps account and checkout pages within the viewport', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@junglegaming.test', password: 'jungle123' }),
    })
    await fetch('/api/cart/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }),
    })
  })
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/profile', '/wallets', '/checkout']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(documentWidth, `${route} em ${width}px`).toBeLessThanOrEqual(width)
    }
  }
})

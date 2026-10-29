import { expect, test } from '@playwright/test'

test('renders the catalog and opens an NFT detail', async ({ page }) => {
  await page.goto('/')
  const heroTitle = page.viewportSize()?.width && page.viewportSize()!.width < 600 ? /cultura digital/i : /seja dono do futuro/i
  await expect(page.getByRole('heading', { name: heroTitle })).toBeVisible()
  const nft = page.getByRole('link', { name: /emerald ape/i }).first()
  await expect(nft).toBeVisible()
  await nft.click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  const buyLabel = (page.viewportSize()?.width ?? 0) < 768 ? 'Comprar NFT' : 'COMPRAR'
  await page.getByRole('button', { name: buyLabel, exact: true }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByText('Emerald Ape #042').filter({ visible: true }).first()).toBeVisible()
})

test('authenticates and returns to the requested route', async ({ page }) => {
  await page.goto('/login?redirect=%2Fcart')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.locator('main')).toBeVisible()
})

test('preserves login across reload and clears it on logout', async ({ page }) => {
  await page.goto('/login?redirect=%2Fprofile')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
  })
  await page.reload()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
})

test('transfers the guest cart to the account on login', async ({ page }) => {
  await page.goto('/nft/nft-aurora')
  const isMobile = (page.viewportSize()?.width ?? 0) < 768
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/cart$/)

  await page.goto('/login?redirect=%2Fcart')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()
})

test('opens the profile from the desktop header and persists edits', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, 'The desktop header is hidden on mobile')
  await page.goto('/login?redirect=%2F')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()

  await page.locator('header a[aria-label="Meu perfil"]').click()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  await page.getByLabel(/Nome de usuário/).fill('ana_kurio')
  await page.getByLabel(/Nome ENS/).fill('ana')
  await page.getByLabel(/Apelido da carteira/).fill('Principal')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Perfil salvo com sucesso.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel(/Nome de usuário/)).toHaveValue('ana_kurio')
})

test('persists a registered account without storing its password in clear text', async ({ page }) => {
  const email = `collector-${crypto.randomUUID()}@example.test`
  const password = 'registered-pass-123'
  await page.goto('/register')
  await page.locator('input[name=name]').fill('Colecionador Teste')
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill(password)
  await page.locator('input[name=confirmPassword]').fill(password)
  await page.locator('button[type=submit]').click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')

  const stored = await page.evaluate(() => localStorage.getItem('kurio:mock-state:v1'))
  expect(stored).toContain(email)
  expect(stored).not.toContain(password)
  expect(stored).toContain('passwordHash')

  await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST' }) })
  await page.reload()
  await page.goto('/login')
  await page.locator('input[name=email]:visible').fill(email)
  await page.locator('input[name=password]:visible').fill(password)
  await page.locator('button[type=submit]:visible').click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
})

test('returns to checkout after the active session expires', async ({ page }) => {
  await page.clock.install()
  await page.goto('/login?redirect=%2Fcheckout')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect(page).toHaveURL(/\/checkout$/)

  await page.clock.fastForward(60 * 60 * 1000 + 1_000)
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
})

test('does not show the previous account favorites after switching users', async ({ page }) => {
  const isMobile = (page.viewportSize()?.width ?? 0) < 768
  const favoriteLabel = isMobile ? 'Curtir NFT' : 'Favoritar NFT'
  const unfavoriteLabel = isMobile ? 'Descurtir NFT' : 'Desfavoritar NFT'
  await page.goto('/login')
  await page.locator('input[name=email]:visible').fill('ana@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  await page.goto('/nft/emerald-ape-042')
  await page.getByRole('button', { name: favoriteLabel }).filter({ visible: true }).first().click()
  await expect(page.getByRole('button', { name: unfavoriteLabel }).filter({ visible: true }).first()).toBeVisible()

  await page.goto('/profile')
  await page.locator('aside button', { hasText: 'Sair' }).click()
  await page.goto('/login')
  await page.locator('input[name=email]:visible').fill('caio@junglegaming.test')
  await page.locator('input[name=password]:visible').fill('jungle123')
  await page.locator('button[type=submit]:visible').click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
  await page.goto('/nft/emerald-ape-042')
  await expect(page.getByRole('button', { name: favoriteLabel }).filter({ visible: true }).first()).toBeVisible()
})

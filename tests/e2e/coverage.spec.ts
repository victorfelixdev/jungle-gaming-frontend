import { expect, test } from '@playwright/test'

test('combines catalog search and filters in the URL across reload', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, 'Os filtros mobile são cobertos em accessibility.spec.ts.')
  await page.goto('/')
  const sidebar = page.locator('aside').first()
  await sidebar.getByRole('button', { name: /Arte digital/ }).click()
  await expect(page).toHaveURL(/categories/)
  await sidebar.getByRole('button', { name: /Ethereum/ }).click()
  await expect(page).toHaveURL(/networks/)
  const search = page.locator('#catalog').getByRole('textbox', { name: 'Buscar no catálogo' })
  await search.fill('Emerald')
  await search.press('Enter')
  await expect(page).toHaveURL(/query=Emerald/)
  await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()
  await page.reload()
  await expect(search).toHaveValue('Emerald')
  await expect(sidebar.getByRole('button', { name: /Arte digital/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(sidebar.getByRole('button', { name: /Ethereum/ })).toHaveAttribute('aria-pressed', 'true')
})

test('restores catalog pagination and sort with browser history', async ({ page }) => {
  await page.goto('/')
  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await pagination.getByRole('button', { name: '2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  if (mobile) await page.getByRole('button', { name: 'Abrir filtros' }).click()
  const sortScope = mobile ? page.getByRole('dialog', { name: 'Filtros' }) : page
  await sortScope.getByRole('button', { name: /Ordenar por/ }).click()
  await page.getByRole('option', { name: 'Menor preço' }).click()
  if (mobile) await page.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page).toHaveURL(/sort=price-asc/)
  await expect(page).toHaveURL(/page=1/)
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
  await expect(pagination.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('handles a direct link to a missing NFT', async ({ page }) => {
  await page.goto('/nft/does-not-exist')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
})

test('rolls back an optimistic favorite when its request fails', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'favorite-error' }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
  })
  await page.goto('/nft/nft-aurora')
  const mobile = (page.viewportSize()?.width ?? 0) < 768
  const add = page.getByRole('button', { name: mobile ? 'Curtir NFT' : 'Favoritar NFT' }).filter({ visible: true }).first()
  const remove = page.getByRole('button', { name: mobile ? 'Descurtir NFT' : 'Desfavoritar NFT' }).filter({ visible: true }).first()
  await expect(add).toBeVisible()
  await add.click()
  await expect(remove).toBeVisible()
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('Não foi possível salvar o favorito.')
  await expect(add).toBeVisible()
  const favorites = await page.evaluate(async () => (await (await fetch('/api/favorites')).json()) as unknown[])
  expect(favorites).toHaveLength(0)
})

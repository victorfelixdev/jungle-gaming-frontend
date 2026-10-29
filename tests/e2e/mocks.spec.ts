import { expect, test } from '@playwright/test'

test('selects and resets deterministic catalog scenarios', async ({ page }) => {
  await page.goto('/mock')
  const readEdition = () => page.evaluate(async () => {
    const response = await fetch('/api/nfts/nft-aurora')
    const nft = await response.json()
    return nft.editions.find((edition: { id: string }) => edition.id === 'ed-aurora')
  })

  await page.getByRole('button', { name: /Catálogo vazio/ }).click()
  await expect(page.getByRole('button', { name: /Catálogo vazio/ })).toHaveAttribute('aria-pressed', 'true')
  const empty = await page.evaluate(async () => (await fetch('/api/nfts')).json())
  expect(empty.total).toBe(0)

  await page.getByRole('button', { name: /Preço alterado/ }).click()
  await expect(page.getByRole('button', { name: /Preço alterado/ })).toHaveAttribute('aria-pressed', 'true')
  expect((await readEdition()).price).toBe('1.49')
  await page.getByRole('button', { name: /Edição esgotada/ }).click()
  await expect(page.getByRole('button', { name: /Edição esgotada/ })).toHaveAttribute('aria-pressed', 'true')
  expect((await readEdition()).availableQuantity).toBe(0)
  await page.getByRole('button', { name: /Padrão/ }).click()
  await expect(page.getByRole('button', { name: /Padrão/ })).toHaveAttribute('aria-pressed', 'true')
  expect((await readEdition()).price).toBe('1.19')
  expect((await readEdition()).availableQuantity).toBe(50)
})

test('reproduces network errors, recovery, and out-of-order responses', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const select = (scenario: string) => page.evaluate(async (value) => {
    await fetch('/api/mock/scenario', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: value }) })
  }, scenario)

  await select('server-error')
  expect(await page.evaluate(async () => (await fetch('/api/nfts')).status)).toBe(503)
  await select('offline')
  expect(await page.evaluate(async () => fetch('/api/nfts').then(() => false).catch(() => true))).toBe(true)
  await select('transient-error')
  expect(await page.evaluate(async () => (await fetch('/api/nfts')).status)).toBe(503)
  expect(await page.evaluate(async () => (await fetch('/api/nfts')).status)).toBe(200)

  await select('out-of-order')
  const completion = await page.evaluate(async () => {
    const order: string[] = []
    await Promise.all(['slow', 'fast'].map(async (query) => {
      await fetch(`/api/nfts?query=${query}`)
      order.push(query)
    }))
    return order
  })
  expect(completion).toEqual(['fast', 'slow'])
})

test('returns API validation, conflict, and expired-coupon errors', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const result = await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'registration-conflict' }) })
    const registration = await fetch('/api/auth/register', { method: 'POST', ...json({ name: 'Teste', email: 'new@example.test', password: 'password123' }) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'expired-coupon' }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    const profile = await fetch('/api/profile')
    const invalidWallet = await fetch('/api/wallets', { method: 'POST', ...json({ label: '', address: '', network: 'invalid' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
    const coupon = await fetch('/api/quotes', { method: 'POST', ...json({ coupon: 'JUNGLE10' }) })
    return { registration: registration.status, profile: profile.status, invalidWallet: invalidWallet.status, coupon: await coupon.json(), couponStatus: coupon.status }
  })
  expect(result.registration).toBe(409)
  expect(result.profile).toBe(200)
  expect(result.invalidWallet).toBe(422)
  expect(result.couponStatus).toBe(409)
  expect(result.coupon.code).toBe('COUPON_EXPIRED')
})

test('persists an NFT change, rejects a stale quote, and restores the fixture', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const result = await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
    const quote = await (await fetch('/api/quotes', { method: 'POST', ...json({}) })).json()
    const walletId = (await (await fetch('/api/wallets')).json())[0].id
    const changed = await fetch('/api/mock/nfts/nft-aurora', { method: 'POST', ...json({ editionId: 'ed-aurora', price: '1.49' }) })
    const staleOrder = await fetch('/api/orders', { method: 'POST', ...json({ walletId, quote, idempotencyKey: 'stale-price' }) })
    return { changedStatus: changed.status, staleStatus: staleOrder.status, staleCode: (await staleOrder.json()).code }
  })
  expect(result).toEqual({ changedStatus: 200, staleStatus: 409, staleCode: 'STALE_QUOTE' })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const persistedPrice = await page.evaluate(async () => {
    const nft = await (await fetch('/api/nfts/nft-aurora')).json()
    return nft.editions.find((edition: { id: string }) => edition.id === 'ed-aurora').price
  })
  expect(persistedPrice).toBe('1.49')
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Resetar dados' }).click(),
  ])
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const resetPrice = await page.evaluate(async () => {
    const nft = await (await fetch('/api/nfts/nft-aurora')).json()
    return nft.editions.find((edition: { id: string }) => edition.id === 'ed-aurora').price
  })
  expect(resetPrice).toBe('1.19')
})

test('recovers an order after response loss and retains the cart on refusal', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const result = await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const select = (scenario: string) => fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario }) })
    const prepare = async () => {
      await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
      await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
      const quote = await (await fetch('/api/quotes', { method: 'POST', ...json({}) })).json()
      const wallets = await (await fetch('/api/wallets')).json()
      return { quote, walletId: wallets[0].id }
    }

    await select('order-timeout')
    const first = await prepare()
    const input = { ...first, idempotencyKey: 'same-attempt' }
    const responseLost = await fetch('/api/orders', { method: 'POST', ...json(input) }).then(() => false).catch(() => true)
    const retry = await fetch('/api/orders', { method: 'POST', ...json(input) })
    const order = await retry.json()
    const conflict = await fetch('/api/orders', { method: 'POST', ...json({ ...input, provider: 'Other' }) })
    const confirmedCart = await (await fetch('/api/cart')).json()

    await select('payment-declined')
    const second = await prepare()
    const declined = await (await fetch('/api/orders', { method: 'POST', ...json({ ...second, idempotencyKey: 'declined-attempt' }) })).json()
    const declinedCart = await (await fetch('/api/cart')).json()
    return { responseLost, retryStatus: retry.status, orderStatus: order.status, conflictStatus: conflict.status, confirmedItems: confirmedCart.items.length, declinedStatus: declined.status, declinedItems: declinedCart.items.length }
  })
  expect(result).toEqual({ responseLost: true, retryStatus: 200, orderStatus: 'confirmed', conflictStatus: 409, confirmedItems: 0, declinedStatus: 'declined', declinedItems: 1 })
})

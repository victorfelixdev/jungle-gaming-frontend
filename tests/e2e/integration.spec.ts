import { expect, test } from '@playwright/test'

async function prepareCheckout(page: import('@playwright/test').Page, scenario: string) {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async (selected) => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: selected }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
  }, scenario)
  await page.goto('/checkout')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
}

async function submitCheckout(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const form = page.locator('#desktop-checkout-form')
    await form.locator('[name=displayName]').fill('Ana')
    await form.locator('[name=username]').fill('ana')
    await form.locator('[name=network]').selectOption('polygon')
    await form.locator('[name=profileName]').fill('Colecionadora')
    await form.locator('[name=walletAddress]').fill('nova.kurio.eth')
    await form.locator('[name=walletType]').selectOption('coinbase')
    await form.locator('[name=email]').fill('ana@junglegaming.test')
  }
  await page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true }).click()
}

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

test('shows an NFT in the cart even when it is outside the first catalog page', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  const name = await page.evaluate(async () => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'default' }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    const catalog = await (await fetch('/api/nfts?page=2&pageSize=24')).json()
    const nft = catalog.items[0]
    if (!nft) throw new Error('The fixture needs more than 24 NFTs')
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: nft.id, editionId: nft.editions[0].id, quantity: 1 }) })
    return nft.name as string
  })
  await page.goto('/cart')
  await expect(page.getByRole('link', { name }).filter({ visible: true }).first()).toBeVisible()
})

test('shows recoverable catalog and detail errors when the API is unavailable', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/scenario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'server-error' }),
    })
  })
  await page.goto('/')
  await expect(page.getByText('Não foi possível carregar o catálogo.')).toBeVisible()
  await page.goto('/nft/nft-aurora')
  await expect(page.getByRole('heading', { name: 'Não foi possível carregar este NFT.' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/scenario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'default' }),
    })
  })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('recovers a confirmed order after the first response is lost', async ({ page }) => {
  await prepareCheckout(page, 'order-timeout')
  await submitCheckout(page)
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('Tente novamente para recuperar esta compra.')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page).toHaveURL(/\/order\/[^/]+$/)
  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
})

test('recovers the same order after a reload following response loss', async ({ page }) => {
  await prepareCheckout(page, 'order-timeout')
  await submitCheckout(page)
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('Tente novamente para recuperar esta compra.')
  await page.reload()
  await expect(page).toHaveURL(/\/order\/[^/]+$/)
  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
  const orders = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('kurio:mock-state:v1') ?? '{}')
    return stored.ordersByUser?.['u-ana']?.length ?? 0
  })
  expect(orders).toBe(1)
})

test('updates a pending order and keeps its original receipt after a price change', async ({ page }) => {
  await prepareCheckout(page, 'order-pending')
  await submitCheckout(page)
  await expect(page).toHaveURL(/\/order\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Pedido em processamento' })).toBeVisible()
  const orderId = new URL(page.url()).pathname.split('/').pop()
  const result = await page.evaluate(async (id) => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/mock/nfts/nft-aurora', { method: 'POST', ...json({ editionId: 'ed-aurora', price: '2.49' }) })
    return fetch(`/api/mock/orders/${id}/status`, { method: 'POST', ...json({ status: 'confirmed' }) }).then((response) => response.status)
  }, orderId)
  expect(result).toBe(200)
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(page.getByText('1.19 ETH').filter({ visible: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('1.19 ETH').filter({ visible: true })).toBeVisible()
})

test('requires a new confirmation after the quoted price changes', async ({ page }) => {
  await prepareCheckout(page, 'default')
  await page.evaluate(async () => {
    await fetch('/api/mock/nfts/nft-aurora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editionId: 'ed-aurora', price: '1.49' }),
    })
  })
  await expect(page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar cotação' }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByText('1.506 ETH').filter({ visible: true }).first()).toBeVisible()
  await submitCheckout(page)
  await expect(page).toHaveURL(/\/order\/[^/]+$/)
})

test('keeps later cart additions when a pending order is confirmed', async ({ page }) => {
  await prepareCheckout(page, 'order-pending')
  await submitCheckout(page)
  await expect(page).toHaveURL(/\/order\/[^/]+$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()
  const result = await page.evaluate(async (id) => {
    const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-jungle', editionId: 'ed-jungle-a', quantity: 1 }) })
    await fetch(`/api/mock/orders/${id}/status`, { method: 'POST', ...json({ status: 'confirmed' }) })
    return (await (await fetch('/api/cart')).json()).items.map((item: { nftId: string }) => item.nftId)
  }, orderId)
  expect(result).toEqual(['nft-jungle'])
})

test('keeps the cart and checkout open after payment is declined', async ({ page }) => {
  await prepareCheckout(page, 'payment-declined')
  await submitCheckout(page)
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('Pagamento recusado. Seu carrinho foi preservado')
  await expect(page).toHaveURL(/\/checkout$/)
  const count = await page.evaluate(async () => (await (await fetch('/api/cart')).json()).items.length)
  expect(count).toBe(1)
})

test('keeps the cart when the wallet disconnects before creating an order', async ({ page }) => {
  await prepareCheckout(page, 'wallet-disconnected')
  await submitCheckout(page)
  await expect(page.getByRole('alert').filter({ visible: true }).first()).toContainText('A carteira foi desconectada')
  await expect(page).toHaveURL(/\/checkout$/)
  const result = await page.evaluate(async () => {
    const cart = await (await fetch('/api/cart')).json()
    const stored = JSON.parse(localStorage.getItem('kurio:mock-state:v1') ?? '{}')
    return { items: cart.items.length, orders: stored.ordersByUser?.['u-ana']?.length ?? 0 }
  })
  expect(result).toEqual({ items: 1, orders: 0 })
})

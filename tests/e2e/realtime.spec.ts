import { expect, test } from '@playwright/test'

test('updates the open NFT detail from a Socket.IO event', async ({ page }) => {
  await page.goto('/nft/nft-aurora')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByText('1.19 ETH').filter({ visible: true }).first()).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/nfts/nft-aurora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editionId: 'ed-aurora', price: '1.49' }),
    })
  })
  await expect(page.getByText('1.49 ETH').filter({ visible: true }).first()).toBeVisible()
})

test('ignores duplicate and old NFT events', async ({ page }) => {
  await page.goto('/nft/nft-aurora')
  await expect(page.getByText('1.19 ETH').filter({ visible: true }).first()).toBeVisible()
  await page.evaluate(async () => {
    const original = await (await fetch('/api/nfts/nft-aurora')).json()
    const updated = await (await fetch('/api/mock/nfts/nft-aurora', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editionId: 'ed-aurora', price: '1.49' }),
    })).json()
    for (const nft of [updated, updated, original]) await fetch('/api/mock/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'nft.updated', payload: { id: nft.id, version: nft.version, nft } }),
    })
  })
  await expect(page.getByText('1.49 ETH').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('1.19 ETH').filter({ visible: true })).toHaveCount(0)
})

test('reconciles missed updates after reconnecting', async ({ page }) => {
  await page.goto('/nft/nft-aurora')
  await expect(page.getByText('1.19 ETH').filter({ visible: true }).first()).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/realtime', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connected: false }) })
    await fetch('/api/mock/nfts/nft-aurora', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editionId: 'ed-aurora', price: '1.59' }) })
    await fetch('/api/mock/realtime', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connected: true }) })
  })
  await expect(page.getByText('1.59 ETH').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 })
})

test('requires reviewing a changed quote before purchase', async ({ page }) => {
  await page.goto('/mock')
  await expect(page.getByRole('heading', { name: 'Cenários de demonstração' })).toBeVisible()
  await page.evaluate(async () => {
    const json = (value: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
    await fetch('/api/mock/scenario', { method: 'PUT', ...json({ scenario: 'default' }) })
    await fetch('/api/auth/login', { method: 'POST', ...json({ email: 'ana@junglegaming.test', password: 'jungle123' }) })
    await fetch('/api/cart/items', { method: 'POST', ...json({ nftId: 'nft-aurora', editionId: 'ed-aurora', quantity: 1 }) })
  })
  await page.goto('/checkout')
  await expect(page.getByText('1.206 ETH').filter({ visible: true }).first()).toBeVisible()
  await page.evaluate(async () => {
    await fetch('/api/mock/nfts/nft-aurora', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editionId: 'ed-aurora', price: '1.49' }) })
  })
  await expect(page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar cotação' }).filter({ visible: true }).click()
  await expect(page.getByText('1.506 ETH').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' }).filter({ visible: true })).toBeEnabled()
})

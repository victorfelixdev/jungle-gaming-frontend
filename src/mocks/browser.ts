import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mockState } from './state'

export const worker = setupWorker(...handlers)

export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MSW === 'false') return
  await mockState.prepare()
  await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } })
}

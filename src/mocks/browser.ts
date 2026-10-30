import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mockState } from './state'
import { realtimeHandler } from './realtime'

export const worker = setupWorker(...handlers, realtimeHandler)

export async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MSW === 'false') return
  await mockState.prepare()
  await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } })
}

import { useSyncExternalStore } from 'react'
import type { CartItem } from '@/api/contracts'

const storageKey = 'kurio:guest-cart'
const changeEvent = 'kurio:guest-cart-change'
let snapshot: CartItem[] | undefined

const read = (): CartItem[] => {
  if (snapshot) return snapshot
  try {
    snapshot = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as CartItem[]
  } catch {
    snapshot = []
  }
  return snapshot
}

const write = (items: CartItem[]) => {
  snapshot = items
  localStorage.setItem(storageKey, JSON.stringify(items))
  window.dispatchEvent(new Event(changeEvent))
}

export function addGuestCartItem(input: Omit<CartItem, 'id'>) {
  const items = read()
  const current = items.find((item) => item.nftId === input.nftId && item.editionId === input.editionId)
  if (current) {
    current.quantity += input.quantity
  } else {
    items.push({ id: crypto.randomUUID(), ...input })
  }
  write(items)
}

export function updateGuestCartItem(id: string, quantity: number) {
  write(read().map((item) => item.id === id ? { ...item, quantity } : item))
}

export function removeGuestCartItem(id: string) {
  write(read().filter((item) => item.id !== id))
}

export function getGuestCart() {
  return read()
}

export function clearGuestCart() {
  write([])
}

export function useGuestCart() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener(changeEvent, callback)
      return () => window.removeEventListener(changeEvent, callback)
    },
    read,
    () => [],
  )
}

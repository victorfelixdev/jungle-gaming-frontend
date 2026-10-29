import { queryOptions, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import type { Credentials, RegisterInput, Session } from '@/api/contracts'
import { apiClient } from '@/api/client'

export const sessionQueryKey = ['session'] as const
export const cartQueryKey = (userId?: string) => ['cart', userId] as const
export const walletsQueryKey = (userId?: string) => ['wallets', userId] as const
export const quoteQueryKey = (userId?: string, coupon?: string, cartVersion?: number) =>
  ['quote', userId, coupon, cartVersion] as const
export const orderQueryKey = (userId?: string, orderId?: string) => ['order', userId, orderId] as const

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<Session | null> => {
    try {
      return (await apiClient.get<Session>('/session')).data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        window.dispatchEvent(new Event('kurio:session-expired'))
        return null
      }
      throw error
    }
  },
  staleTime: 0,
  refetchOnWindowFocus: 'always',
  refetchInterval: (query) => query.state.data ? 15_000 : false,
})

export const useSession = () => useQuery(sessionQueryOptions)

export const signIn = async (input: Credentials) => (await apiClient.post<Session>('/auth/login', input)).data
export const signUp = async (input: RegisterInput) => (await apiClient.post<Session>('/auth/register', input)).data
export const signOut = async (queryClient: QueryClient) => {
  await apiClient.post('/auth/logout')
  queryClient.setQueryData(sessionQueryKey, null)
  clearPrivateCache(queryClient)
}

export async function requireSession(queryClient: QueryClient) {
  const session = await queryClient.fetchQuery(sessionQueryOptions)
  return session
}

export function clearPrivateCache(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: ({ queryKey }) => ['user', 'cart', 'favorites', 'wallets', 'quote', 'order'].includes(String(queryKey[0])),
  })
}

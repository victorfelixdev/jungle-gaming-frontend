import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(undefined, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 &&
      !['/session', '/auth/login', '/auth/register'].includes(error.config?.url ?? '')) {
    window.dispatchEvent(new Event('kurio:session-expired'))
  }
  return Promise.reject(error)
})

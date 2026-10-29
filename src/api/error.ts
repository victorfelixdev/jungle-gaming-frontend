import axios from 'axios'
import type { ApiError } from './contracts'

export function getApiError(error: unknown): ApiError {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data) return error.response.data
  return { code: 'NETWORK_ERROR', message: 'Não foi possível concluir a solicitação. Tente novamente.' }
}

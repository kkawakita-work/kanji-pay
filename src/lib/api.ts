// The API base URL: defaults to local port 3000 for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface PaymentCreateResponse {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  clientSecret: string
}

export interface PaymentGetResponse {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  createdAt: string
}

/**
 * Lightweight native fetch wrapper matching the Hono Client RPC syntax.
 * This completely isolates the front-end build environment from shukin-api's
 * node_modules to resolve cross-package version conflicts.
 */
export const api = {
  v1: {
    payments: {
      $get: async () => {
        const response = await fetch(`${API_BASE_URL}/v1/payments`)
        return {
          ok: response.ok,
          json: async (): Promise<PaymentGetResponse[]> => response.json()
        }
      },
      $post: async (req: { json: { amount: number; memberName: string } }) => {
        const response = await fetch(`${API_BASE_URL}/v1/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.json)
        })
        return {
          ok: response.ok,
          json: async (): Promise<PaymentCreateResponse> => response.json()
        }
      },
      ':id': {
        $get: async (req: { param: { id: string } }) => {
          const response = await fetch(`${API_BASE_URL}/v1/payments/${req.param.id}`)
          return {
            ok: response.ok,
            json: async (): Promise<PaymentGetResponse> => response.json()
          }
        }
      }
    }
  }
}

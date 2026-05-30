// The API base URL: defaults to local port 3000 for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface TenantResponse {
  id: string
  name: string
  type: 'EVENT' | 'CLUB'
  adminToken: string // Secure token returned to host
  createdAt: string
}

export interface PaymentCreateResponse {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  clientSecret: string
  tenantId: string
}

export interface PaymentGetResponse {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  createdAt: string
  tenantId: string
}

/**
 * Custom lightweight Hono RPC fetch client wrapper updated with secure token protection.
 */
export const api = {
  v1: {
    tenants: {
      $post: async (req: { json: { name: string; type: 'EVENT' | 'CLUB' } }) => {
        const response = await fetch(`${API_BASE_URL}/v1/tenants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.json)
        })
        return {
          ok: response.ok,
          json: async (): Promise<TenantResponse> => response.json()
        }
      }
    },
    payments: {
      $get: async (req: { query: { tenantId: string; token?: string } }) => {
        const tokenQuery = req.query.token ? `&token=${req.query.token}` : ''
        const response = await fetch(`${API_BASE_URL}/v1/payments?tenantId=${req.query.tenantId}${tokenQuery}`)
        return {
          ok: response.ok,
          json: async (): Promise<PaymentGetResponse[]> => response.json()
        }
      },
      $post: async (req: { json: { amount: number; memberName: string; tenantId: string } }) => {
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

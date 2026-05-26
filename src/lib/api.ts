// The API base URL: defaults to local port 3000 for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface TenantResponse {
  id: string
  name: string
  type: 'EVENT' | 'CLUB'
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
 * Custom lightweight Hono RPC fetch client wrapper updated with Multi-Tenant Support.
 * decuoples the frontend build context from backend's local node_modules.
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
      $get: async (req: { query: { tenantId: string } }) => {
        const response = await fetch(`${API_BASE_URL}/v1/payments?tenantId=${req.query.tenantId}`)
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

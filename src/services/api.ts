// The API base URL: defaults to local port 3000 for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface TenantResponse {
  id: string
  name: string
  type: 'EVENT' | 'CLUB'
  adminToken: string // Secure token returned to host
  stripeConnectedAccountId?: string // Stripe Connect connected account ID
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

export interface StripeOnboardingResponse {
  onboardingUrl: string
  tenantId: string
  adminToken: string
}

/**
 * Custom lightweight Hono RPC fetch client wrapper updated with secure token protection.
 */
export const api = {
  v1: {
    tenants: {
      $get: async (req: { param: { id: string }; query: { token: string } }) => {
        const response = await fetch(`${API_BASE_URL}/v1/tenants/${req.param.id}?token=${req.query.token}`)
        return {
          ok: response.ok,
          status: response.status,
          json: async (): Promise<TenantResponse> => response.json()
        }
      },
      $post: async (req: {
        json: {
          name: string
          type: 'EVENT' | 'CLUB'
          paymentType?: 'STRIPE_DIRECT' | 'STRIPE_CONNECT' | 'JPYC'
          stripeConnectedAccountId?: string
        }
      }) => {
        const response = await fetch(`${API_BASE_URL}/v1/tenants`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.json)
        })
        return {
          ok: response.ok,
          status: response.status,
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
      $post: async (req: { 
        json: { 
          amount: number; 
          memberName: string; 
          tenantId: string;
          metadata?: { eventId: string };
        } 
      }) => {
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
    },
    stripe: {
      onboarding: {
        $post: async (req: {
          json: {
            type: 'EVENT' | 'CLUB'
            paymentType: 'STRIPE_CONNECT'
            origin: string
          }
        }) => {
          const response = await fetch(`${API_BASE_URL}/v1/stripe/onboarding`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.json)
          })
          return {
            ok: response.ok,
            status: response.status,
            json: async (): Promise<StripeOnboardingResponse> => response.json()
          }
        }
      }
    }
  }
}

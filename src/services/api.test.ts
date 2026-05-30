import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './api'

describe('api (API通信層 - Hono RPCフェッチラッパー)', () => {
  let fetchSpy: any

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('【正常系】tenants.$post が正しいURLとパラメータでPOSTリクエストを送信し、テナント情報を取得できること', async () => {
    const mockTenant = {
      id: 'tenant-123',
      name: 'テスト用イベント',
      type: 'EVENT',
      adminToken: 'token-abc',
      createdAt: '2026-05-30T12:00:00Z'
    }

    // fetch のレスポンスをモック
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTenant
    } as Response)

    const response = await api.v1.tenants.$post({
      json: { name: 'テスト用イベント', type: 'EVENT' }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockTenant)

    // fetch 呼び出しの引数検証
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/tenants'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'テスト用イベント', type: 'EVENT' })
      })
    )
  })

  test('【正常系】tenants.$post が stripeConnectedAccountId や paymentType を指定してリクエストを送信し、テナント情報を取得できること', async () => {
    const mockTenant = {
      id: 'tenant-connect-123',
      name: 'Connect割り勘イベント',
      type: 'EVENT',
      paymentType: 'STRIPE_CONNECT',
      stripeConnectedAccountId: 'acct_123456789',
      adminToken: 'token-abc',
      createdAt: '2026-05-30T12:00:00Z'
    }

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTenant
    } as Response)

    const response = await api.v1.tenants.$post({
      json: {
        name: 'Connect割り勘イベント',
        type: 'EVENT',
        paymentType: 'STRIPE_CONNECT',
        stripeConnectedAccountId: 'acct_123456789'
      }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockTenant)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/tenants'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Connect割り勘イベント',
          type: 'EVENT',
          paymentType: 'STRIPE_CONNECT',
          stripeConnectedAccountId: 'acct_123456789'
        })
      })
    )
  })

  test('【正常系】payments.$get が tenantId と token をクエリに含めてGETリクエストを送信し、決済一覧を取得できること', async () => {
    const mockPayments = [
      {
        id: 'payment-1',
        amount: 3000,
        memberName: 'アリス',
        status: 'SUCCESS',
        createdAt: '2026-05-30T12:05:00Z',
        tenantId: 'tenant-123'
      }
    ]

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments
    } as Response)

    const response = await api.v1.payments.$get({
      query: { tenantId: 'tenant-123', token: 'secure-token' }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockPayments)

    // クエリパラメータの検証
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/payments?tenantId=tenant-123&token=secure-token')
    )
  })

  test('【正常系】payments.$get が token なしのGETリクエストを送信し、決済一覧を取得できること', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response)

    const response = await api.v1.payments.$get({
      query: { tenantId: 'tenant-123' }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual([])

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/payments?tenantId=tenant-123')
    )
    // tokenがパラメータに含まれていないことを確認
    const urlCalled = fetchSpy.mock.calls[0][0]
    expect(urlCalled).not.toContain('token=')
  })

  test('【正常系】payments.$post が正しいURLとパラメータでPOSTリクエストを送信し、決済作成情報を取得できること', async () => {
    const mockPaymentCreate = {
      id: 'payment-2',
      amount: 1500,
      memberName: 'ボブ',
      status: 'PENDING',
      clientSecret: 'secret_xxx',
      tenantId: 'tenant-123'
    }

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaymentCreate
    } as Response)

    const response = await api.v1.payments.$post({
      json: { amount: 1500, memberName: 'ボブ', tenantId: 'tenant-123' }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockPaymentCreate)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/payments'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1500, memberName: 'ボブ', tenantId: 'tenant-123' })
      })
    )
  })

  test('【正常系】payments[\':id\'].$get が指定されたIDでGETリクエストを送信し、決済情報を取得できること', async () => {
    const mockPayment = {
      id: 'payment-2',
      amount: 1500,
      memberName: 'ボブ',
      status: 'SUCCESS',
      createdAt: '2026-05-30T12:10:00Z',
      tenantId: 'tenant-123'
    }

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayment
    } as Response)

    const response = await api.v1.payments[':id'].$get({
      param: { id: 'payment-2' }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockPayment)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/payments/payment-2')
    )
  })

  test('【正常系】v1.stripe.onboarding.$post が正しいURLとパラメータでPOSTリクエストを送信し、オンボーディングURLを取得できること', async () => {
    const mockResponse = {
      onboardingUrl: 'https://connect.stripe.com/setup/s/mock_123',
      tenantId: 'tenant-onboard-123',
      adminToken: 'token-onboard-123'
    }

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response)

    const response = await api.v1.stripe.onboarding.$post({
      json: {
        type: 'EVENT',
        paymentType: 'STRIPE_CONNECT',
        origin: 'http://localhost:5173'
      }
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data).toEqual(mockResponse)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/stripe/onboarding'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'EVENT',
          paymentType: 'STRIPE_CONNECT',
          origin: 'http://localhost:5173'
        })
      })
    )
  })
})

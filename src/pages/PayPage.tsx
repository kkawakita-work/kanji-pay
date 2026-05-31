import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Coins, User, Wallet, CreditCard, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { getStripe } from '../services/stripe'

const PayPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [baseAmount, setBaseAmount] = useState<number>(0)
  const [memberName, setMemberName] = useState<string>('')
  const [selectedTip, setSelectedTip] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [tenantId, setTenantId] = useState<string>('')

  const [paymentMethod, setPaymentMethod] = useState<'paypay' | 'card'>('paypay')
  const [stripeInstance, setStripeInstance] = useState<any>(null)
  const [cardElement, setCardElement] = useState<any>(null)

  // Load split amount and tenantId from query parameters
  useEffect(() => {
    const amtParam = searchParams.get('amount')
    const tenantParam = searchParams.get('tenantId')

    if (!tenantParam) {
      setErrorMsg('集金イベント情報 (tenantId) が不足しています。幹事から共有された正しいURLを開いてください。')
      return
    }
    setTenantId(tenantParam)

    if (amtParam) {
      const parsed = parseInt(amtParam, 10)
      if (!isNaN(parsed) && parsed > 0) {
        setBaseAmount(parsed)
      } else {
        setErrorMsg('無効な割り勘金額です。正しいリンクを使用してください。')
      }
    } else {
      setErrorMsg('決済金額が指定されていません。幹事から共有された正しいURLを開いてください。')
    }
  }, [searchParams])

  // Initialize Stripe instance
  useEffect(() => {
    if (baseAmount === 0 || errorMsg || !tenantId) return

    const initStripe = async () => {
      const stripe = await getStripe()
      if (stripe) {
        setStripeInstance(stripe)
      }
    }
    initStripe()
  }, [baseAmount, errorMsg, tenantId])

  // Initialize and mount Card Element when 'card' method is active
  useEffect(() => {
    if (!stripeInstance || paymentMethod !== 'card') return

    let active = true
    let card: any = null

    const mountCard = () => {
      const elements = stripeInstance.elements()
      card = elements.create('card', {
        hidePostalCode: true,
        style: {
          base: {
            color: '#1f2937',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '15px',
            '::placeholder': {
              color: '#9ca3af'
            }
          },
          invalid: {
            color: '#ef4444',
            iconColor: '#ef4444'
          }
        }
      })

      setTimeout(() => {
        const container = document.getElementById('card-element')
        if (container && active) {
          card.mount('#card-element')
          setCardElement(card)
        }
      }, 50)
    }

    mountCard()

    return () => {
      active = false
      if (card) {
        try {
          card.destroy()
        } catch (e) {
          console.warn('Stripe card destruction deferred or already handled:', e)
        }
        setCardElement(null)
      }
    }
  }, [stripeInstance, paymentMethod])

  const tipOptions = [
    { label: 'なし', value: 0 },
    { label: '+¥100', value: 100 },
    { label: '+¥200', value: 200 },
    { label: '+¥500', value: 500 },
    { label: '+¥1,000', value: 1000 },
    { label: '+¥2,000', value: 2000 }
  ]

  const totalAmount = baseAmount + selectedTip

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberName.trim()) {
      setErrorMsg('お名前を入力してください。')
      return
    }
    if (totalAmount <= 0) {
      setErrorMsg('合計金額が0円以下です。')
      return
    }
    if (!tenantId) {
      setErrorMsg('テナント情報が見つかりません。リロードをお試しください。')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      // 1. Fetch Stripe PaymentIntent (clientSecret) from shukin-api
      const res = await api.v1.payments.$post({
        json: {
          amount: totalAmount,
          memberName: memberName.trim(),
          tenantId: tenantId,
          metadata: {
            eventId: tenantId
          }
        }
      })

      if (!res.ok) {
        const errData = await res.json() as any
        throw new Error(errData.error || '決済情報の作成に失敗しました。')
      }

      const payment = await res.json() as any
      const { clientSecret, id: paymentId } = payment

      if (!stripeInstance) {
        throw new Error('Stripe決済システムが初期化されていません。ブラウザのリロードをお試しください。')
      }

      if (paymentMethod === 'paypay') {
        // 2. Confirm the PayPay Payment using standard unified confirmPayment API
        const returnUrl = `${window.location.origin}/status/${paymentId}`

        const { error } = await stripeInstance.confirmPayment({
          clientSecret,
          confirmParams: {
            return_url: returnUrl,
            payment_method_data: {
              type: 'paypay',
              billing_details: {
                name: memberName.trim()
              }
            }
          }
        })

        if (error) {
          console.error('Stripe PayPay confirm error:', error)
          throw new Error(error.message || '決済処理中にエラーが発生しました。')
        }
      } else {
        // 2. Confirm the Card Payment using standard confirmCardPayment SDK
        if (!cardElement) {
          throw new Error('クレジットカード入力欄が準備できていません。しばらく待ってから再度お試しください。')
        }

        const { error, paymentIntent } = await stripeInstance.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: memberName.trim()
            }
          }
        })

        if (error) {
          console.error('Stripe card confirm error:', error)
          throw new Error(error.message || 'クレジットカード決済処理中にエラーが発生しました。')
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          navigate(`/status/${paymentId}`)
        } else {
          throw new Error('決済の処理が完了しませんでした。ステータスをご確認ください。')
        }
      }

    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || '通信エラーが発生しました。時間を置いて再度お試しください。')
      setLoading(false)
    }
  }

  // Handle invalid/empty URL params state
  if (errorMsg && baseAmount === 0) {
    return (
      <div className="card">
        <div className="header">
          <h1 className="logo">
            <Coins size={28} />
            kanji-pay
          </h1>
        </div>
        <div className="alert alert-danger">
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          幹事画面へ
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="header">
        <h1 className="logo">
          <Coins size={28} />
          kanji-pay
        </h1>
        <p className="subtitle">割り勘決済 ＆ 幹事へのチップ送金</p>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="memberName">
            あなたのお名前（表示名）
          </label>
          <div className="input-container">
            <span className="input-icon">
              <User size={20} />
            </span>
            <input
              id="memberName"
              type="text"
              className="input-field input-with-icon"
              placeholder="山田 太郎"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">
            お支払い方法を選択
          </label>
          <div className="payment-tabs">
            <button
              type="button"
              className={`payment-tab ${paymentMethod === 'paypay' ? 'active-paypay' : ''}`}
              onClick={() => setPaymentMethod('paypay')}
              disabled={loading}
            >
              <div className="payment-tab-title">
                <span className="paypay-badge" style={{ margin: 0, padding: '2px 8px' }}>PayPay</span>
              </div>
            </button>
            <button
              type="button"
              className={`payment-tab ${paymentMethod === 'card' ? 'active-card' : ''}`}
              onClick={() => setPaymentMethod('card')}
              disabled={loading}
            >
              <div className="payment-tab-title" style={{ gap: '8px' }}>
                <CreditCard size={18} />
                <span>クレジットカード</span>
              </div>
            </button>
          </div>
        </div>

        {paymentMethod === 'paypay' ? (
          <div className="form-group input-animate" style={{ marginBottom: '24px' }}>
            <div 
              style={{ 
                padding: '14px 16px', 
                border: '1px solid rgba(255, 0, 59, 0.15)', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: 'rgba(255, 0, 59, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="paypay-badge">PayPay</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>PayPay残高払い</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>手数料無料</span>
            </div>
            <p className="text-muted" style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
              ※「PayPayで支払う」ボタンをタップすると、自動的にPayPayアプリまたはブラウザの認証画面へ安全に切り替わります。
            </p>
          </div>
        ) : (
          <div className="form-group input-animate" style={{ marginBottom: '24px' }}>
            <label className="form-label">
              クレジットカード情報
            </label>
            <div 
              id="card-element" 
              style={{ 
                padding: '12px 14px', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: '#fff',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* Stripe Card Element mounts here */}
            </div>
            <p className="text-muted" style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
              ※クレジットカード情報はStripeによって安全に暗号化され、サーバーを通過せずに直接処理されます。
            </p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            幹事へのチップ（任意）
          </label>
          <p className="text-muted" style={{ marginBottom: '8px', fontSize: '12px' }}>
            イベント調整や進行をしてくれた幹事さんへ、感謝のチップを上乗せできます。
          </p>
          <div className="tip-grid">
            {tipOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`tip-button ${selectedTip === opt.value ? 'active' : ''}`}
                onClick={() => setSelectedTip(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="result-box" style={{ marginTop: '24px' }}>
          <div className="flex-between text-muted" style={{ marginBottom: '8px', fontSize: '13px' }}>
            <span>基本割り勘額:</span>
            <span>¥{baseAmount.toLocaleString()}</span>
          </div>
          <div className="flex-between text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
            <span>感謝のチップ:</span>
            <span>+¥{selectedTip.toLocaleString()}</span>
          </div>
          <div className="flex-between" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <span style={{ fontWeight: '700' }}>合計支払金額:</span>
            <span className="result-value" style={{ margin: 0 }}>
              ¥{totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className={paymentMethod === 'paypay' ? 'btn btn-paypay' : 'btn btn-primary'}
          disabled={loading || !memberName.trim()}
        >
          {loading ? (
            <>
              <span className="loader" style={{ borderTopColor: '#fff', marginRight: '6px' }}></span>
              {paymentMethod === 'paypay' ? 'PayPay連携中...' : '決済処理中...'}
            </>
          ) : (
            <>
              {paymentMethod === 'paypay' ? (
                <>
                  <Wallet size={18} />
                  PayPayで支払う
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  クレジットカードで支払う
                </>
              )}
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default PayPage

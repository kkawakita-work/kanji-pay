import React, { useState, useEffect } from 'react'
import { 
  Coins, Users, Link, Copy, Check, RefreshCw, Calendar, 
  ChevronDown, ChevronUp, CheckCircle2, CreditCard, Plus, X, AlertCircle
} from 'lucide-react'
import { api } from '../services/api'

interface ManagedEvent {
  id: string
  name: string
  adminToken: string
  totalAmount: number
  membersCount: number
  perMemberAmount: number
  createdAt: string
  paymentType: 'STRIPE_DIRECT' | 'STRIPE_CONNECT' | 'JPYC'
  stripeConnectedAccountId?: string
}

interface PaymentInfo {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  createdAt: string
}

const HostPage: React.FC = () => {
  // 1. Core States for Host Management
  const [events, setEvents] = useState<ManagedEvent[]>([])
  const [paymentsMap, setPaymentsMap] = useState<{ [eventId: string]: PaymentInfo[] }>({})
  const [collectedMap, setCollectedMap] = useState<{ [eventId: string]: number }>({})
  const [loadingMap, setLoadingMap] = useState<{ [eventId: string]: boolean }>({})
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  
  // UI States
  const [showModal, setShowModal] = useState<boolean>(false)
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null)

  // 2. New Event Creation States (Stripe Connect is required & streamlined)
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [membersCount, setMembersCount] = useState<string>('')
  const [modalLoading, setModalLoading] = useState<boolean>(false)
  const [modalError, setModalError] = useState<boolean>(false)
  const [modalErrorMsg, setModalErrorMsg] = useState<string>('')
  
  // Generated success URL inside modal
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [newTenantId, setNewTenantId] = useState<string>('')
  const [newAdminToken, setNewAdminToken] = useState<string>('')

  // 3. Load events, sync payments, AND handle Stripe Connect Callback redirect
  useEffect(() => {
    // 🔍 Stripe Connect Onboarding Callback detection
    const searchParams = new URLSearchParams(window.location.search)
    const stripeConnectStatus = searchParams.get('stripe_connect')

    let tempEvents: ManagedEvent[] = []

    try {
      const saved = localStorage.getItem('kanjipay_events')
      if (saved) {
        tempEvents = JSON.parse(saved)
      }
    } catch (err) {
      console.error('Failed to load saved events:', err)
    }

    if (stripeConnectStatus === 'success') {
      const tenantId = searchParams.get('tenantId') || ''
      const token = searchParams.get('token') || ''
      const amount = parseInt(searchParams.get('amount') || '0', 10)
      const count = parseInt(searchParams.get('count') || '0', 10)
      const perAmount = parseInt(searchParams.get('perAmount') || '0', 10)

      if (tenantId && token && amount > 0) {
        // 重複登録を防止
        if (!tempEvents.some(e => e.id === tenantId)) {
          const newEvent: ManagedEvent = {
            id: tenantId,
            name: `${amount.toLocaleString()}円割り勘 (${count}人)`,
            adminToken: token,
            totalAmount: amount,
            membersCount: count,
            perMemberAmount: perAmount,
            createdAt: new Date().toISOString(),
            paymentType: 'STRIPE_CONNECT'
          }
          
          tempEvents = [newEvent, ...tempEvents]
          localStorage.setItem('kanjipay_events', JSON.stringify(tempEvents))
          console.log(`Successfully registered Stripe Connect tenant: ${tenantId}`)
        }

        // コピー用の成功URLを表示する状態にする
        const origin = window.location.origin
        const checkoutUrl = `${origin}/pay?tenantId=${tenantId}&amount=${perAmount}`
        setGeneratedUrl(checkoutUrl)
        setNewTenantId(tenantId)
        setNewAdminToken(token)
        setShowModal(true)

        // URLパラメータをクリアして綺麗な履歴に戻す (F5リロード等での重複登録防止)
        window.history.replaceState({}, '', '/')
      }
    }

    // Sort and set final events list
    const sorted = tempEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setEvents(sorted)
    
    // Sync current progress for each managed event from D1 Database
    sorted.forEach(event => {
      syncEventPayments(event.id, event.adminToken)
    })
  }, [])

  // Sync payments from D1 database for a specific event
  const syncEventPayments = async (eventId: string, adminToken: string) => {
    setLoadingMap(prev => ({ ...prev, [eventId]: true }))
    try {
      const res = await api.v1.payments.$get({
        query: { tenantId: eventId, token: adminToken }
      })
      if (!res.ok) throw new Error('同期失敗')
      
      const data: PaymentInfo[] = await res.json()
      
      // Calculate successful payment sums
      const totalCollected = data
        .filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0)

      setPaymentsMap(prev => ({ ...prev, [eventId]: data }))
      setCollectedMap(prev => ({ ...prev, [eventId]: totalCollected }))
    } catch (err) {
      console.error(`Failed to sync payments for event ${eventId}:`, err)
    } finally {
      setLoadingMap(prev => ({ ...prev, [eventId]: false }))
    }
  }

  // Calculate dynamic split amount per member (Rounded up to 10-yen units)
  const calculatePerMember = (): number => {
    const amount = parseFloat(totalAmount)
    const count = parseInt(membersCount)
    if (isNaN(amount) || isNaN(count) || count <= 0) return 0
    
    // 10-yen unit rounding up
    return Math.ceil((amount / count) / 10) * 10
  }

  const perMemberAmount = calculatePerMember()

  // Handle Stripe Connect standard onboarding redirect
  const handleStartOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (perMemberAmount <= 0) return

    setModalLoading(true)
    setModalError(false)
    setModalErrorMsg('')

    try {
      // 1. Build dynamic callback origin containing state variables (amount, count, perAmount)
      // This is passed so when Stripe redirects back to redirect_uri, we restore exact state in frontend!
      const originWithState = `${window.location.origin}/?amount=${totalAmount}&count=${membersCount}&perAmount=${perMemberAmount}`

      // 2. Call the onboarding API on shukin-api backend
      const res = await api.v1.stripe.onboarding.$post({
        json: {
          type: 'EVENT',
          paymentType: 'STRIPE_CONNECT',
          origin: originWithState
        }
      })

      if (!res.ok) {
        throw new Error('オンボーディングの作成に失敗しました。バックエンドの接続を確認してください。')
      }

      const onboardingData = await res.json()
      const { onboardingUrl } = onboardingData

      if (!onboardingUrl) {
        throw new Error('利用申請URLの発行に失敗しました。')
      }

      // 3. Immediately redirect host to Stripe's secure registration/login page
      window.location.href = onboardingUrl

    } catch (err: any) {
      console.error(err)
      setModalError(true)
      setModalErrorMsg(err.message || '通信エラーが発生しました。再度お試しください。')
      setModalLoading(false)
    }
  }

  // Copy quick action for payment URL
  const handleCopyLink = async (eventId: string, amount: number) => {
    const origin = window.location.origin
    const url = `${origin}/pay?tenantId=${eventId}&amount=${amount}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedEventId(eventId)
      setTimeout(() => setCopiedEventId(null), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="card" style={{ maxWidth: '600px' }}>
      {/* Dashboard Header */}
      <div className="header flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 className="logo" style={{ margin: 0 }}>
          <Coins size={28} />
          kanji-pay
        </h1>
        <button 
          type="button" 
          className="btn btn-primary" 
          style={{ width: 'auto', padding: '10px 16px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
          onClick={() => {
            // Reset form states
            setTotalAmount('')
            setMembersCount('')
            setGeneratedUrl('')
            setModalError(false)
            setModalErrorMsg('')
            setShowModal(true)
          }}
        >
          <Plus size={16} />
          新規集金を作成
        </button>
      </div>

      {/* Events Listing */}
      {events.length === 0 ? (
        // Welcome Blank Screen for new hosts
        <div className="text-center" style={{ padding: '60px 20px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <Coins size={36} />
          </div>
          <h2>ようこそ kanji-pay へ！</h2>
          <p className="text-muted" style={{ margin: '12px auto 24px auto', maxWidth: '360px', fontSize: '14px', lineHeight: '1.6' }}>
            kanji-pay は、幹事の手間を劇的に削減するスマート割り勘ツールです。スマホ決済（PayPay）やカードに対応した集金リンクを数秒で作成できます。
          </p>
          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ width: 'auto', padding: '14px 28px' }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            最初の集金イベントを作る
          </button>
        </div>
      ) : (
        // Event List for active hosts
        <div>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>📊 管理中の集金イベント（最近作成順）</h2>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => {
                events.forEach(e => syncEventPayments(e.id, e.adminToken))
              }}
            >
              <RefreshCw size={12} /> 一括更新
            </button>
          </div>

          <div className="event-grid">
            {events.map(event => {
              const collected = collectedMap[event.id] || 0
              const target = event.totalAmount
              const percent = target > 0 ? Math.min(Math.round((collected / target) * 100), 100) : 0
              const isLoading = loadingMap[event.id]
              const payments = paymentsMap[event.id] || []
              const isActive = activeCardId === event.id

              return (
                <div 
                  key={event.id} 
                  className={`event-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCardId(isActive ? null : event.id)
                    if (!paymentsMap[event.id]) {
                      syncEventPayments(event.id, event.adminToken)
                    }
                  }}
                >
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{event.name}</h3>
                    <span className="text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {formatDate(event.createdAt)}
                    </span>
                  </div>

                  <div className="flex-between text-muted" style={{ fontSize: '12px', marginBottom: '8px' }}>
                    <span>一人あたり: <strong>¥{event.perMemberAmount.toLocaleString()}</strong> ({event.membersCount}人)</span>
                    <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CreditCard size={11} /> {event.paymentType === 'STRIPE_CONNECT' ? '自動送金' : '直接決済'}
                    </span>
                  </div>

                  {/* Progress Status */}
                  <div className="flex-between" style={{ marginTop: '14px', fontSize: '13px', fontWeight: '600' }}>
                    <span className="text-muted">集金状況</span>
                    <span style={{ color: percent === 100 ? 'var(--success)' : 'var(--text-main)' }}>
                      ¥{collected.toLocaleString()} / ¥{target.toLocaleString()} ({percent}%)
                    </span>
                  </div>

                  {/* Progress Bar with CSS Animation */}
                  <div className="progress-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  {/* Quick Copy Link Bar */}
                  <div className="flex-between" style={{ marginTop: '16px', gap: '8px' }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-copy"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)' }}
                      onClick={() => handleCopyLink(event.id, event.perMemberAmount)}
                    >
                      {copiedEventId === event.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedEventId === event.id ? 'リンクコピー完了' : '決済リンクをコピー'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '8px', borderRadius: 'var(--radius-sm)' }}
                      title="詳細を開く"
                      onClick={() => setActiveCardId(isActive ? null : event.id)}
                    >
                      {isActive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Accordion inline detail panel (Payment guest list) */}
                  <div className={`accordion-content ${isActive ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                    <div className="flex-between" style={{ marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>📋 支払済みのメンバー</h4>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}
                        onClick={() => syncEventPayments(event.id, event.adminToken)}
                        disabled={isLoading}
                      >
                        <RefreshCw size={10} className={isLoading ? 'loader' : ''} style={{ border: 'none', width: '10px', height: '10px' }} />
                        更新
                      </button>
                    </div>

                    {isLoading && payments.length === 0 ? (
                      <div className="text-center" style={{ padding: '20px 0' }}>
                        <span className="loader" style={{ width: '20px', height: '20px' }}></span>
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="text-muted text-center" style={{ padding: '20px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                        まだ決済完了したメンバーはいません。<br />決済リンクをシェアして集金を始めましょう！
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '8px 12px' }}>メンバー</th>
                              <th style={{ padding: '8px 12px' }}>金額</th>
                              <th style={{ padding: '8px 12px' }}>状況</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map(pay => (
                              <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: '600' }}>{pay.memberName}</td>
                                <td style={{ padding: '8px 12px', fontWeight: '700' }}>¥{pay.amount.toLocaleString()}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span className={`badge ${pay.status === 'SUCCESS' ? 'badge-success' : pay.status === 'PENDING' ? 'badge-pending' : 'badge-danger'}`}>
                                    {pay.status === 'SUCCESS' ? '完了' : pay.status === 'PENDING' ? '処理中' : '失敗'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 🌐 Glassmorphism Event Creation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>

            <div className="header" style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Plus size={22} className="text-primary" />
                新しい集集イベントを作成
              </h2>
              <p className="subtitle">割り勘金額を計算し、決済リンクを即座に生成します</p>
            </div>

            {modalError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{modalErrorMsg}</div>
              </div>
            )}

            {!generatedUrl ? (
              // Event Parameter Input Form (Stripe Connect Standard onboarding redirect flow)
              <form onSubmit={handleStartOnboarding}>
                <div className="form-group">
                  <label className="form-label" htmlFor="totalAmount">
                    イベント合計金額
                  </label>
                  <div className="input-container">
                    <span className="input-icon">
                      <Coins size={20} />
                    </span>
                    <input
                      id="totalAmount"
                      type="number"
                      className="input-field input-with-icon input-with-unit"
                      placeholder="50000"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      min="1"
                      disabled={modalLoading}
                      required
                    />
                    <span className="input-unit">円</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="membersCount">
                    参加人数（幹事含む）
                  </label>
                  <div className="input-container">
                    <span className="input-icon">
                      <Users size={20} />
                    </span>
                    <input
                      id="membersCount"
                      type="number"
                      className="input-field input-with-icon input-with-unit"
                      placeholder="10"
                      value={membersCount}
                      onChange={(e) => setMembersCount(e.target.value)}
                      min="1"
                      disabled={modalLoading}
                      required
                    />
                    <span className="input-unit">人</span>
                  </div>
                </div>

                {perMemberAmount > 0 && (
                  <div className="result-box" style={{ padding: '12px', marginBottom: '20px' }}>
                    <div className="result-label" style={{ fontSize: '11px' }}>一人あたりの支払い金額</div>
                    <div className="result-value" style={{ fontSize: '24px' }}>¥{perMemberAmount.toLocaleString()}</div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>（端数10円単位切り上げ）</div>
                  </div>
                )}

                {/* 💳 Stripe Connect Security Notification Panel */}
                {perMemberAmount > 0 && (
                  <div className="alert alert-success" style={{ margin: '20px 0', border: '1px solid var(--border)' }}>
                    <CreditCard size={18} className="text-primary" style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                      <strong>Stripe Connect (自動即時送金) が必須適用されます</strong><br />
                      決済ボタンをクリックすると、Stripeの安全な利用申請（ログイン）画面に遷移します。申請完了後、集金リンクが自動生成されます。
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={perMemberAmount <= 0 || modalLoading}
                  style={{ marginTop: '12px' }}
                >
                  {modalLoading ? (
                    <>
                      <span className="loader" style={{ width: '16px', height: '16px' }}></span>
                      Stripeと連携中...
                    </>
                  ) : (
                    <>
                      <Link size={18} />
                      Stripeで集金（利用申請画面へ）
                    </>
                  )}
                </button>
              </form>
            ) : (
              // Success generated URL Display Screen after callback success
              <div className="share-section" style={{ borderTop: 'none', paddingTop: 0, animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-center" style={{ fontSize: '18px', marginBottom: '8px' }}>🎉 決済リンクが完成しました！</h3>
                <p className="text-muted text-center" style={{ marginBottom: '20px', fontSize: '13px', lineHeight: '1.5' }}>
                  Stripe Connect 連携が正常に完了しました！<br />
                  以下のリンクをLINEやグループチャットにシェアして、集金を開始しましょう！
                </p>

                <div className="share-link-box">
                  <div className="share-link-text">{generatedUrl}</div>
                  <button
                    type="button"
                    className="btn btn-primary btn-copy"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedUrl)
                        setCopiedEventId(newTenantId)
                        setTimeout(() => setCopiedEventId(null), 2000)
                      } catch (err) {
                        console.error(err)
                      }
                    }}
                  >
                    {copiedEventId === newTenantId ? <Check size={14} /> : <Copy size={14} />}
                    {copiedEventId === newTenantId ? 'コピー完了' : 'コピー'}
                  </button>
                </div>

                <div className="alert alert-success" style={{ margin: '16px 0 24px 0' }}>
                  幹事様の手間はこれだけ！支払者がリンクを開くと、スマートフォン決済（PayPay）やカードで即座に決済を行えます。
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    // Close modal and sync the newly created event payments
                    setShowModal(false)
                    syncEventPayments(newTenantId, newAdminToken)
                    setActiveCardId(newTenantId) // Auto expand the new event
                  }}
                >
                  ダッシュボードに戻る
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default HostPage

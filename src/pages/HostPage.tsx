import React, { useState, useEffect } from 'react'
import { 
  Coins, Users, Link, Copy, Check, TrendingUp, AlertCircle, 
  CreditCard, Plus, X, RefreshCw, Calendar, 
  ChevronDown, ChevronUp, CheckCircle2
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
  stripeAccountId?: string
}

interface PaymentInfo {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  createdAt: string
}

const HostPage: React.FC = () => {
  // 1. Core States for Consolidated Host Management
  const [events, setEvents] = useState<ManagedEvent[]>([])
  const [paymentsMap, setPaymentsMap] = useState<{ [eventId: string]: PaymentInfo[] }>({})
  const [collectedMap, setCollectedMap] = useState<{ [eventId: string]: number }>({})
  const [loadingMap, setLoadingMap] = useState<{ [eventId: string]: boolean }>({})
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  
  // UI States
  const [showModal, setShowModal] = useState<boolean>(false)
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null)

  // 2. New Event Creation Form States
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [membersCount, setMembersCount] = useState<string>('')
  const [useConnect, setUseConnect] = useState<boolean>(false)
  const [stripeAccountId, setStripeAccountId] = useState<string>('')
  const [modalLoading, setModalLoading] = useState<boolean>(false)
  const [modalError, setModalError] = useState<boolean>(false)
  const [modalErrorMsg, setModalErrorMsg] = useState<string>('')
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [newTenantId, setNewTenantId] = useState<string>('')
  const [newAdminToken, setNewAdminToken] = useState<string>('')

  // Load events from localStorage on mount and sync their payments from D1
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kanjipay_events')
      if (saved) {
        const parsedEvents: ManagedEvent[] = JSON.parse(saved)
        // 並び順は作成日時降順
        const sorted = parsedEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setEvents(sorted)
        
        // 各イベントの進捗・データを非同期で並行同期
        sorted.forEach(event => {
          syncEventPayments(event.id, event.adminToken)
        })
      }
    } catch (err) {
      console.error('Failed to load saved events:', err)
    }
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
      
      // 成功した決済額を合算
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
  };

  // Calculate dynamic split amount per member
  const calculatePerMember = (): number => {
    const amount = parseFloat(totalAmount)
    const count = parseInt(membersCount)
    if (isNaN(amount) || isNaN(count) || count <= 0) return 0
    return Math.ceil(amount / count)
  }

  const perMemberAmount = calculatePerMember()

  // Handle new event creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (perMemberAmount <= 0) return

    setModalLoading(true)
    setModalError(false)
    setModalErrorMsg('')
    setGeneratedUrl('')

    try {
      const paymentType = useConnect ? 'STRIPE_CONNECT' : 'STRIPE_DIRECT'
      
      // 1. Create a dynamic Tenant on shukin-api D1 database
      const res = await api.v1.tenants.$post({
        json: {
          name: `${parseInt(totalAmount).toLocaleString()}円割り勘 (${membersCount}人)`,
          type: 'EVENT',
          paymentType,
          stripeAccountId: useConnect ? stripeAccountId.trim() : undefined
        }
      })

      if (!res.ok) {
        throw new Error('割り勘イベントの作成に失敗しました。')
      }

      const tenant = await res.json()
      setNewTenantId(tenant.id)
      setNewAdminToken(tenant.adminToken)

      // 2. Build guest checkout URL
      const origin = window.location.origin
      const url = `${origin}/pay?tenantId=${tenant.id}&amount=${perMemberAmount}`
      setGeneratedUrl(url)

      // 3. Save to localStorage
      const newEvent: ManagedEvent = {
        id: tenant.id,
        name: `${parseInt(totalAmount).toLocaleString()}円割り勘 (${membersCount}人)`,
        adminToken: tenant.adminToken,
        totalAmount: parseInt(totalAmount),
        membersCount: parseInt(membersCount),
        perMemberAmount,
        createdAt: new Date().toISOString(),
        paymentType,
        stripeAccountId: useConnect ? stripeAccountId.trim() : undefined
      }

      const updatedEvents = [newEvent, ...events]
      localStorage.setItem('kanjipay_events', JSON.stringify(updatedEvents))
      setEvents(updatedEvents)

      // Initialize maps for new event
      setCollectedMap(prev => ({ ...prev, [tenant.id]: 0 }))
      setPaymentsMap(prev => ({ ...prev, [tenant.id]: [] }))

    } catch (err: any) {
      console.error(err)
      setModalError(true)
      setModalErrorMsg(err.message || '通信エラーが発生しました。再度お試しください。')
    } finally {
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

  const isSubmitDisabled = 
    perMemberAmount <= 0 || 
    modalLoading || 
    (useConnect && (!stripeAccountId.trim() || !stripeAccountId.trim().startsWith('acct_')))

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
            setUseConnect(false)
            setStripeAccountId('')
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
                新しい集金イベントを作成
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
              // Event Parameter Input Form
              <form onSubmit={handleCreateEvent}>
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
                    <div className="text-muted" style={{ fontSize: '11px' }}>（端数切り上げ）</div>
                  </div>
                )}

                {/* 💳 Stripe Connect Settings Section */}
                {perMemberAmount > 0 && (
                  <div className="form-group" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div className="flex-between" style={{ alignItems: 'center' }}>
                      <div>
                        <label className="form-label" style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CreditCard size={18} className="text-primary" />
                          Stripe Connect (幹事自動送金)
                        </label>
                        <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>
                          参加者の支払額を、幹事のStripeアカウントへ直接・即座に自動送金します。
                        </p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={useConnect}
                          onChange={(e) => {
                            setUseConnect(e.target.checked)
                            if (!e.target.checked) {
                              setStripeAccountId('')
                            }
                          }}
                          disabled={modalLoading}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    {useConnect && (
                      <div className="input-animate" style={{ marginTop: '16px' }}>
                        <label className="form-label" htmlFor="stripeAccountId" style={{ fontSize: '13px' }}>
                          Stripe 接続アカウント ID
                        </label>
                        <div className="input-container">
                          <span className="input-icon">
                            <TrendingUp size={20} />
                          </span>
                          <input
                            id="stripeAccountId"
                            type="text"
                            className="input-field input-with-icon"
                            placeholder="acct_xxxxxxxxxxxxxx"
                            value={stripeAccountId}
                            onChange={(e) => setStripeAccountId(e.target.value)}
                            disabled={modalLoading}
                            required={useConnect}
                          />
                        </div>
                        <p className="text-muted" style={{ fontSize: '11px', marginTop: '6px', color: stripeAccountId.trim() && !stripeAccountId.trim().startsWith('acct_') ? 'var(--danger)' : 'var(--text-muted)' }}>
                          Stripeダッシュボードで作成した Connect 接続アカウント ID（acct_ で始まるID）を入力してください。
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitDisabled}
                  style={{ marginTop: '12px' }}
                >
                  {modalLoading ? (
                    <>
                      <span className="loader" style={{ width: '16px', height: '16px' }}></span>
                      イベント作成中...
                    </>
                  ) : (
                    <>
                      <Link size={18} />
                      決済リンクを作成する
                    </>
                  )}
                </button>
              </form>
            ) : (
              // Success generated URL Display Screen
              <div className="share-section" style={{ borderTop: 'none', paddingTop: 0, animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-center" style={{ fontSize: '18px', marginBottom: '8px' }}>🎉 決済リンクが完成しました！</h3>
                <p className="text-muted text-center" style={{ marginBottom: '20px', fontSize: '13px', lineHeight: '1.5' }}>
                  以下のリンクをLINEやグループチャットにシェアして、参加者から集金を開始しましょう！
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

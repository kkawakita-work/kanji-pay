import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Coins, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

interface PaymentInfo {
  id: string
  amount: number
  memberName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  createdAt: string
}

const StatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [pollCount, setPollCount] = useState<number>(0)

  const fetchStatus = async () => {
    if (!id) return
    try {
      // Type-safe RPC query parameter call
      const res = await api.v1.payments[':id'].$get({
        param: { id }
      })

      if (!res.ok) {
        throw new Error('決済状況の取得に失敗しました。')
      }

      const data = await res.json() as PaymentInfo
      setPayment(data)
      setLoading(false)

      // Increment polling counter if status is still pending
      if (data.status === 'PENDING') {
        setPollCount((prev) => prev + 1)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || '通信エラーが発生しました。')
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchStatus()
  }, [id])

  // Polling loop: runs every 3 seconds if state is PENDING, up to 15 times (45s total)
  useEffect(() => {
    if (!payment || payment.status !== 'PENDING' || pollCount >= 15) return

    const timer = setTimeout(() => {
      fetchStatus()
    }, 3000)

    return () => clearTimeout(timer)
  }, [payment, pollCount])

  // Loading state (initial load only)
  if (loading && pollCount === 0) {
    return (
      <div className="card text-center">
        <div className="header">
          <h1 className="logo">
            <Coins size={28} />
            kanji-pay
          </h1>
        </div>
        <span className="loader" style={{ width: '40px', height: '40px', marginBottom: '16px' }}></span>
        <p className="text-muted">決済情報を確認しています...</p>
      </div>
    )
  }

  // Error state
  if (errorMsg) {
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
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          幹事画面に戻る
        </button>
      </div>
    )
  }

  const status = payment?.status

  return (
    <div className="card text-center">
      <div className="header">
        <h1 className="logo">
          <Coins size={28} />
          kanji-pay
        </h1>
      </div>

      {status === 'SUCCESS' && (
        <div>
          <div style={{ color: 'var(--success)', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <CheckCircle2 size={64} />
          </div>
          <h2 style={{ color: 'var(--success)' }}>🎉 決済が完了しました！</h2>
          <p className="text-muted" style={{ margin: '16px 0 24px 0', fontSize: '13px' }}>
            {payment?.memberName}様、ご協力ありがとうございました。<br />
            幹事様への送金処理が正常に受け付けられました。
          </p>
          <div className="result-box" style={{ background: 'var(--success-light)', borderStyle: 'solid', borderColor: 'var(--success)' }}>
            <div className="result-label" style={{ color: 'var(--success)' }}>お支払い金額</div>
            <div className="result-value" style={{ color: '#065f46', margin: '4px 0' }}>¥{payment?.amount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {status === 'PENDING' && (
        <div>
          <div style={{ color: 'var(--primary)', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Clock size={64} style={{ animation: 'spin 3s linear infinite' }} />
          </div>
          <h2>⌛ 決済状況を確認中...</h2>
          <p className="text-muted" style={{ margin: '16px 0 24px 0', fontSize: '13px' }}>
            ただいまStripeからの支払い完了通知を待機しています。<br />
            このまま少々お待ちいただくか、ページを再読み込みしてください。
          </p>
          {pollCount >= 15 && (
            <div className="alert alert-danger" style={{ textAlign: 'left' }}>
              確認に時間がかかっています。お手数ですが、少し経ってから再読込するか、幹事様へお支払い状況をお問い合わせください。
            </div>
          )}
        </div>
      )}

      {status === 'FAILED' && (
        <div>
          <div style={{ color: 'var(--danger)', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <XCircle size={64} />
          </div>
          <h2 style={{ color: 'var(--danger)' }}>❌ 決済に失敗しました</h2>
          <p className="text-muted" style={{ margin: '16px 0 24px 0', fontSize: '13px' }}>
            決済処理が正常に完了しませんでした。入力情報の確認、または別の決済方法をお試しください。
          </p>
        </div>
      )}

      <button
        className="btn btn-secondary"
        style={{ marginTop: '24px' }}
        onClick={() => navigate('/')}
      >
        新しい割り勘を作成する（幹事用）
      </button>
    </div>
  )
}

export default StatusPage

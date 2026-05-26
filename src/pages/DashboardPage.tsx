import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Coins, TrendingUp, CheckCircle2, Clock, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'
import type { PaymentGetResponse } from '../lib/api'

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [payments, setPayments] = useState<PaymentGetResponse[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const tenantId = searchParams.get('tenantId') || ''

  const loadPayments = async (isRefresh = false) => {
    if (!tenantId) return
    
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setErrorMsg('')

    try {
      // Fetch split bill payment details specifically filtered by our dynamic event tenantId!
      const res = await api.v1.payments.$get({
        query: { tenantId }
      })
      if (!res.ok) {
        throw new Error('決済履歴の取得に失敗しました。')
      }
      const data = await res.json()
      setPayments(data)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || '通信エラーが発生しました。')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Enforce tenantId validation on load
  useEffect(() => {
    if (!tenantId) {
      setErrorMsg('管理用ダッシュボードを開くためのテナント情報 (tenantId) が不足しています。正しいURLを使用してください。')
      setLoading(false)
      return
    }
    loadPayments()
  }, [tenantId])

  // Calculate stats
  const totalCollected = payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0)

  const successCount = payments.filter((p) => p.status === 'SUCCESS').length
  const pendingCount = payments.filter((p) => p.status === 'PENDING').length

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // If no tenantId provided
  if (!tenantId) {
    return (
      <div className="card text-center">
        <div className="header">
          <h1 className="logo">
            <Coins size={28} />
            kanji-pay
          </h1>
        </div>
        <div className="alert alert-danger" style={{ textAlign: 'left' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          幹事画面に戻る
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: '600px' }}>
      <div className="header" style={{ position: 'relative' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 'auto',
            padding: '8px 12px',
            fontSize: '12px'
          }}
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={14} />
          戻る
        </button>
        
        <h1 className="logo" style={{ marginTop: '36px' }}>
          <Coins size={28} />
          kanji-pay
        </h1>
        <p className="subtitle">集集金ダッシュボード（管理用画面）</p>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '24px' }}>
        <div className="result-box" style={{ margin: 0, padding: '12px 8px' }}>
          <div className="result-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px' }}>
            <TrendingUp size={12} /> 総回収額
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: 'var(--primary)' }}>
            ¥{totalCollected.toLocaleString()}
          </div>
        </div>

        <div className="result-box" style={{ margin: 0, padding: '12px 8px', background: 'var(--success-light)', borderColor: 'var(--success)' }}>
          <div className="result-label" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px' }}>
            <CheckCircle2 size={12} /> 完了人数
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: '#065f46' }}>
            {successCount}人
          </div>
        </div>

        <div className="result-box" style={{ margin: 0, padding: '12px 8px', background: '#fffbeb', borderColor: '#f59e0b' }}>
          <div className="result-label" style={{ color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px' }}>
            <Clock size={12} /> 処理中
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0', color: '#b45309' }}>
            {pendingCount}人
          </div>
        </div>
      </div>

      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>📊 集金メンバー一覧</h2>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
          onClick={() => loadPayments(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'loader' : ''} style={{ border: 'none', width: '14px', height: '14px', animationDuration: '2s' }} />
          {refreshing ? '更新中...' : '更新'}
        </button>
      </div>

      {loading && payments.length === 0 ? (
        <div className="text-center" style={{ padding: '40px 0' }}>
          <span className="loader" style={{ width: '32px', height: '32px' }}></span>
          <p className="text-muted" style={{ marginTop: '12px' }}>集金状況をロード中...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center text-muted" style={{ padding: '40px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
          まだ決済情報が登録されていません。<br />
          作成したリンクを共有して、集金を開始しましょう！
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px' }}>メンバー</th>
                <th style={{ padding: '12px' }}>金額</th>
                <th style={{ padding: '12px' }}>ステータス</th>
                <th style={{ padding: '12px' }}>時間</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>{pay.memberName}</td>
                  <td style={{ padding: '12px', fontWeight: '700' }}>¥{pay.amount.toLocaleString()}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        backgroundColor:
                          pay.status === 'SUCCESS'
                            ? 'var(--success-light)'
                            : pay.status === 'PENDING'
                            ? '#fffbeb'
                            : 'var(--danger-light)',
                        color:
                          pay.status === 'SUCCESS'
                            ? '#065f46'
                            : pay.status === 'PENDING'
                            ? '#b45309'
                            : '#991b1b',
                        border: `1px solid ${
                          pay.status === 'SUCCESS'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : pay.status === 'PENDING'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)'
                        }`
                      }}
                    >
                      {pay.status === 'SUCCESS' ? '完了' : pay.status === 'PENDING' ? '処理中' : '失敗'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {formatDate(pay.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DashboardPage

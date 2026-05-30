import React, { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Coins, AlertCircle } from 'lucide-react'

/**
 * 過去の管理URLとの互換リダイレクター。
 * /dashboard?tenantId=xxx&token=yyy でアクセスされた際、
 * 自動的に LocalStorage に集金イベント情報をインポートし、
 * 統合ダッシュボードのホーム画面（/）へリダイレクトします。
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const tenantId = searchParams.get('tenantId') || ''
  const token = searchParams.get('token') || ''

  useEffect(() => {
    if (tenantId && token) {
      try {
        // LocalStorage から既存の管理イベント一覧を取得
        const saved = localStorage.getItem('kanjipay_events')
        const events = saved ? JSON.parse(saved) : []

        // 重複登録を防止
        if (!events.some((e: any) => e.id === tenantId)) {
          events.push({
            id: tenantId,
            name: '共有された集金イベント',
            adminToken: token,
            totalAmount: 0, // ロード時に API から同期するため仮置き
            membersCount: 0,
            perMemberAmount: 0,
            createdAt: new Date().toISOString(),
            paymentType: 'STRIPE_DIRECT'
          })
          localStorage.setItem('kanjipay_events', JSON.stringify(events))
          console.log(`Successfully imported tenant ${tenantId} via legacy dashboard URL`)
        }
      } catch (err) {
        console.error('Failed to import tenant from legacy URL:', err)
      }
      
      // ホームの統合ダッシュボードへリダイレクト
      navigate('/')
    }
  }, [tenantId, token, navigate])

  return (
    <div className="card text-center">
      <div className="header">
        <h1 className="logo">
          <Coins size={28} />
          kanji-pay
        </h1>
      </div>
      
      {!tenantId || !token ? (
        <>
          <div className="alert alert-danger" style={{ textAlign: 'left' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>管理用URLパラメータ (tenantId または token) が不足しています。</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            幹事ダッシュボードへ
          </button>
        </>
      ) : (
        <div style={{ padding: '40px 0' }}>
          <span className="loader" style={{ width: '32px', height: '32px' }}></span>
          <p className="text-muted" style={{ marginTop: '12px' }}>集金イベントをインポート中...</p>
        </div>
      )}
    </div>
  )
}

export default DashboardPage

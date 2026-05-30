import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Users, Link, Copy, Check, TrendingUp, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

const HostPage: React.FC = () => {
  const navigate = useNavigate()
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [membersCount, setMembersCount] = useState<string>('')
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [tenantId, setTenantId] = useState<string>('')
  const [adminToken, setAdminToken] = useState<string>('')

  // Calculate the bill split per member (rounded up)
  const calculatePerMember = (): number => {
    const amount = parseFloat(totalAmount)
    const count = parseInt(membersCount)
    if (isNaN(amount) || isNaN(count) || count <= 0) return 0
    return Math.ceil(amount / count)
  }

  const perMemberAmount = calculatePerMember()

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (perMemberAmount <= 0) return

    setLoading(true)
    setErrorMsg('')
    setGeneratedUrl('')
    setTenantId('')
    setAdminToken('')

    try {
      // 1. Create a dynamic Tenant representing this split event on the Hono backend
      const res = await api.v1.tenants.$post({
        json: {
          name: `${parseInt(totalAmount).toLocaleString()}円割り勘 (${membersCount}人)`,
          type: 'EVENT'
        }
      })

      if (!res.ok) {
        throw new Error('割り勘イベントの作成に失敗しました。')
      }

      const tenant = await res.json()
      setTenantId(tenant.id)
      setAdminToken(tenant.adminToken)

      // 2. Build guest checkout URL with absolute paths including both amount AND tenantId
      const origin = window.location.origin
      const url = `${origin}/pay?tenantId=${tenant.id}&amount=${perMemberAmount}`
      setGeneratedUrl(url)
      setCopied(false)

    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || '通信エラーが発生しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedUrl) return
    try {
      await navigator.clipboard.writeText(generatedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link: ', err)
    }
  }

  return (
    <div className="card">
      <div className="header">
        <h1 className="logo">
          <Coins size={28} />
          kanji-pay
        </h1>
        <p className="subtitle">幹事用：割り勘金額の計算 ＆ 決済リンク生成</p>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleGenerate}>
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
              onChange={(e) => {
                setTotalAmount(e.target.value)
                setGeneratedUrl('') // Clear generated link if input changes
              }}
              min="1"
              disabled={loading}
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
              onChange={(e) => {
                setMembersCount(e.target.value)
                setGeneratedUrl('') // Clear generated link if input changes
              }}
              min="1"
              disabled={loading}
              required
            />
            <span className="input-unit">人</span>
          </div>
        </div>

        {perMemberAmount > 0 && (
          <div className="result-box">
            <div className="result-label">一人あたりの支払い金額</div>
            <div className="result-value">¥{perMemberAmount.toLocaleString()}</div>
            <div className="text-muted">（端数切り上げ）</div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={perMemberAmount <= 0 || loading}
        >
          {loading ? (
            <>
              <span className="loader"></span>
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

      {generatedUrl && (
        <div className="share-section">
          <h2>📤 決済リンクが完成しました！</h2>
          <p className="text-muted" style={{ marginBottom: '12px', fontSize: '13px' }}>
            以下のリンクをLINEやグループチャットにシェアして、参加者から集金してください。
          </p>
          <div className="share-link-box">
            <div className="share-link-text">{generatedUrl}</div>
            <button
              type="button"
              className="btn btn-primary btn-copy"
              onClick={handleCopy}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'コピー完了' : 'コピー'}
            </button>
          </div>
          <div className="alert alert-success">
            幹事様の手間はこれだけ！支払者がリンクを開くと、スマートフォン決済（PayPay）やカードで即座に決済を行えます。
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: '12px' }}
            onClick={() => navigate(`/dashboard?tenantId=${tenantId}&token=${adminToken}`)}
          >
            <TrendingUp size={18} />
            リアルタイムで集金状況を確認する（管理画面）
          </button>
        </div>
      )}
    </div>
  )
}

export default HostPage

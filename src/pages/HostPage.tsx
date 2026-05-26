import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Users, Link, Copy, Check, TrendingUp } from 'lucide-react'

const HostPage: React.FC = () => {
  const navigate = useNavigate()
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [membersCount, setMembersCount] = useState<string>('')
  const [generatedUrl, setGeneratedUrl] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)

  // Calculate the bill split per member (rounded up)
  const calculatePerMember = (): number => {
    const amount = parseFloat(totalAmount)
    const count = parseInt(membersCount)
    if (isNaN(amount) || isNaN(count) || count <= 0) return 0
    return Math.ceil(amount / count)
  }

  const perMemberAmount = calculatePerMember()

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (perMemberAmount <= 0) return

    // Build absolute URL targeting our payment route (/pay)
    const origin = window.location.origin
    const url = `${origin}/pay?amount=${perMemberAmount}`
    setGeneratedUrl(url)
    setCopied(false)
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
          disabled={perMemberAmount <= 0}
        >
          <Link size={18} />
          決済リンクを作成する
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
            onClick={() => navigate('/dashboard')}
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

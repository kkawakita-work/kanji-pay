export interface SplitResult {
  amountPerPerson: number // 1人あたりの支払額（10円単位に丸めた額）
  extraAmount: number     // 端数の合計（幹事が負担[プラス]、またはもらいすぎ[マイナス]となる差額）
}

/**
 * 割り勘計算ロジック（10円単位の丸め対応）
 * 基本は「切り上げ処理（'up'）」で幹事がもらいすぎ（差額が負数）の状態を作ります。
 * 
 * @param totalAmount 総額
 * @param peopleCount 人数
 * @param roundType 丸め処理の方向 ('up' | 'down') デフォルトは 'up'
 */
export function splitBill(
  totalAmount: number,
  peopleCount: number,
  roundType: 'up' | 'down' = 'up'
): SplitResult {
  if (peopleCount <= 0) {
    throw new Error('人数は1人以上で指定してください。')
  }
  if (totalAmount < 0) {
    throw new Error('総額は0円以上で指定してください。')
  }

  const rawAmount = totalAmount / peopleCount
  let amountPerPerson = 0

  if (roundType === 'up') {
    amountPerPerson = Math.ceil(rawAmount / 10) * 10
  } else {
    amountPerPerson = Math.floor(rawAmount / 10) * 10
  }

  const extraAmount = totalAmount - (amountPerPerson * peopleCount)

  return {
    amountPerPerson,
    extraAmount
  }
}

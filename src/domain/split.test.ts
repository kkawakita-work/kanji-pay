import { describe, test, expect } from 'vitest'
import { splitBill } from './split'

describe('splitBill (割り勘端数計算ロジック)', () => {
  test('【正常系】ぴったり割り切れる場合、全員が等額になり、幹事端数差額が0円になること', () => {
    const result = splitBill(3000, 3)
    expect(result.amountPerPerson).toBe(1000)
    expect(result.extraAmount).toBe(0)
  })

  test('【正常系】切り上げ処理（デフォルト）で端数が出る場合、10円単位で切り上げられ、幹事がもらいすぎ（差額がマイナス）になること', () => {
    // 3,025円を3人で分ける場合：
    // 3025 / 3 = 1008.333...
    // 10円単位切り上げ ➔ 1010円
    // 幹事差額 ➔ 3025 - (1010 * 3) = -5円 (5円もらいすぎ)
    const result = splitBill(3025, 3)
    expect(result.amountPerPerson).toBe(1010)
    expect(result.extraAmount).toBe(-5)
  })

  test('【正常系】明示的に切り上げ（up）を指定した場合も、10円単位で切り上げられること', () => {
    const result = splitBill(3025, 3, 'up')
    expect(result.amountPerPerson).toBe(1010)
    expect(result.extraAmount).toBe(-5)
  })

  test('【正常系】切り下げ処理（down）を指定して端数が出る場合、10円単位で切り下げられ、幹事が自己負担（差額がプラス）になること', () => {
    // 3,025円を3人で分ける場合：
    // 3025 / 3 = 1008.333...
    // 10円単位切り下げ ➔ 1000円
    // 幹事差額 ➔ 3025 - (1000 * 3) = 25円 (25円自己負担)
    const result = splitBill(3025, 3, 'down')
    expect(result.amountPerPerson).toBe(1000)
    expect(result.extraAmount).toBe(25)
  })

  test('【正常系】1円単位の端数がないが10円未満の端数がある場合も、正しく10円単位で切り上げられること', () => {
    // 3,001円を3人で分ける場合：
    // 3001 / 3 = 1000.333...
    // 10円単位切り上げ ➔ 1010円
    // 幹事差額 ➔ 3001 - (1010 * 3) = -29円 (29円もらいすぎ)
    const result = splitBill(3001, 3)
    expect(result.amountPerPerson).toBe(1010)
    expect(result.extraAmount).toBe(-29)
  })

  test('【異常系】人数が0人以下の場合、エラーをスローすること', () => {
    expect(() => splitBill(3000, 0)).toThrow('人数は1人以上で指定してください。')
    expect(() => splitBill(3000, -1)).toThrow('人数は1人以上で指定してください。')
  })

  test('【異常系】総額が0円未満の場合、エラーをスローすること', () => {
    expect(() => splitBill(-100, 3)).toThrow('総額は0円以上で指定してください。')
  })
})

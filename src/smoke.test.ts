import { describe, test, expect } from 'vitest'

describe('CI スモークテスト', () => {
  test('【正常系】テストランナーが正常に動作すること', () => {
    expect(1 + 1).toBe(2)
  })
})

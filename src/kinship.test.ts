import { describe, expect, it } from 'vitest'
import { initialFamily } from './data'
import { calculateKinship } from './kinship'

describe('亲属关系推导', () => {
  it('示例家族所有已连通关系都有闽南语音频路径', () => {
    initialFamily.people.forEach((viewer) => initialFamily.people.forEach((target) => {
      const result = calculateKinship(initialFamily, viewer.id, target.id)
      expect(result.minnanAudioTerms.length, `${viewer.name} → ${target.name}: ${result.minnan}`).toBeGreaterThan(0)
    }))
  })
  it('识别父母和祖父母', () => {
    expect(calculateKinship(initialFamily, 'me', 'father').mandarin).toContain('爸爸')
    expect(calculateKinship(initialFamily, 'me', 'p-gf').codes).toEqual(['f', 'f'])
  })

  it('切换主视角后关系随之反转', () => {
    expect(calculateKinship(initialFamily, 'father', 'me').codes).toEqual(['s'])
    expect(calculateKinship(initialFamily, 'daughter', 'me').codes).toEqual(['f'])
  })

  it('使用长幼信息区分兄妹', () => {
    expect(calculateKinship(initialFamily, 'me', 'sister').codes).toEqual(['os'])
    expect(calculateKinship(initialFamily, 'sister', 'me').codes).toEqual(['lb'])
  })

  it('使用生日收窄堂表同辈的长幼称谓', () => {
    expect(calculateKinship(initialFamily, 'me', 'cousin').mandarin).toEqual(['堂哥'])
    expect(calculateKinship(initialFamily, 'me', 'maternal-cousin').mandarin).toEqual(['舅表妹'])
    expect(calculateKinship(initialFamily, 'cousin', 'me').mandarin).toEqual(['堂弟'])
  })

  it('家庭叫法覆盖显示结果并保留系统标准称呼', () => {
    const data = { ...initialFamily, customTerms: [{ viewerId: 'me', targetId: 'maternal-uncle', label: '阿舅' }] }
    const result = calculateKinship(data, 'me', 'maternal-uncle')
    expect(result.mandarin).toEqual(['阿舅'])
    expect(result.standardMandarin).toEqual(['小舅'])
  })
})

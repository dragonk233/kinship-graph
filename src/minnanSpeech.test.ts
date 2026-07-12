import { describe, expect, it } from 'vitest'
import { minnanRecordings, resolveMinnan } from './minnan'
import { hasMinnanRecording } from './minnanSpeech'

describe('闽南语播报', () => {
  it('常见关系使用独立官方称呼', () => {
    expect(resolveMinnan(['s', 'w']).label).toBe('新婦（sin-pū）')
    expect(resolveMinnan(['d', 'h']).audioTerms).toEqual(['囝婿'])
  })

  it('复杂关系回退为可完整播报的关系路径', () => {
    const result = resolveMinnan(['f', 'os', 'h', 'ob', 's'])
    expect(result.kind).toBe('path')
    expect(result.audioTerms).toEqual(['阿爸', '阿姊', '翁', '阿兄', '後生'])
    expect(hasMinnanRecording(result.audioTerms)).toBe(true)
  })

  it('所有基础关系组件都有官方真人录音', () => {
    const result = resolveMinnan(['f', 'm', 'h', 'w', 's', 'd', 'ob', 'lb', 'os', 'ls'])
    expect(result.audioTerms).toHaveLength(10)
    expect(result.audioTerms.every((term) => minnanRecordings[term])).toBe(true)
  })
})

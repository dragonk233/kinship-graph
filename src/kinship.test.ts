import { describe, expect, it } from 'vitest'
import { initialFamily } from './data'
import { calculateKinship } from './kinship'

describe('亲属关系推导', () => {
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
})

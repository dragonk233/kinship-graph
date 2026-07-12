import { describe, expect, it } from 'vitest'
import { findMinnanVoice, minnanTermText } from './minnanSpeech'

describe('闽南语播报', () => {
  it('播报汉字称呼，不读括号内的注音', () => {
    expect(minnanTermText('阿爸（a-pah）')).toBe('阿爸')
  })

  it('只选用 nan-TW 声音，不用普通话冒充', () => {
    const voices = [
      { lang: 'zh-TW', name: 'Mandarin' },
      { lang: 'nan-TW', name: 'Taiwanese Hokkien' },
    ] as SpeechSynthesisVoice[]
    expect(findMinnanVoice(voices)?.name).toBe('Taiwanese Hokkien')
    expect(findMinnanVoice(voices.slice(0, 1))).toBeUndefined()
  })
})

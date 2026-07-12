export function minnanTermText(term: string): string {
  return term.split('（')[0].trim()
}

export function findMinnanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => {
    const language = voice.lang.toLowerCase().replace('_', '-')
    return language === 'nan-tw' || language.startsWith('nan-')
  })
}

export function speakMinnan(term: string, onEnd: () => void): 'started' | 'unsupported' {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return 'unsupported'
  const voice = findMinnanVoice(window.speechSynthesis.getVoices())
  if (!voice) return 'unsupported'

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(minnanTermText(term))
  utterance.lang = 'nan-TW'
  utterance.voice = voice
  utterance.rate = .82
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
  return 'started'
}

let currentAudio: HTMLAudioElement | undefined

export function minnanTermText(term: string): string {
  return term.split('（')[0].trim()
}

export function minnanRomanization(term: string): string | undefined {
  return term.match(/（(.+?)）/)?.[1].trim()
}

export function findMinnanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => {
    const language = voice.lang.toLowerCase().replace('_', '-')
    return language === 'nan-tw' || language.startsWith('nan-')
  })
}

function speakWithDevice(term: string, onEnd: () => void): boolean {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false
  const voice = findMinnanVoice(window.speechSynthesis.getVoices())
  if (!voice) return false
  const utterance = new SpeechSynthesisUtterance(minnanTermText(term))
  utterance.lang = 'nan-TW'
  utterance.voice = voice
  utterance.rate = .82
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
  return true
}

export async function speakMinnan(term: string, onEnd: () => void): Promise<'service' | 'device'> {
  stopMinnanSpeech()
  try {
    const response = await fetch('/api/minnan-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: minnanTermText(term), romanization: minnanRomanization(term) }),
    })
    if (response.ok) {
      const audio = new Audio(URL.createObjectURL(await response.blob()))
      currentAudio = audio
      audio.onended = onEnd
      audio.onerror = onEnd
      await audio.play()
      return 'service'
    }
  } catch {
    // The local/device voice remains a useful offline fallback.
  }
  if (speakWithDevice(term, onEnd)) return 'device'
  throw new Error('MINNAN_TTS_UNAVAILABLE')
}

export function stopMinnanSpeech() {
  window.speechSynthesis?.cancel()
  if (currentAudio) {
    currentAudio.pause()
    if (currentAudio.src.startsWith('blob:')) URL.revokeObjectURL(currentAudio.src)
    currentAudio = undefined
  }
}

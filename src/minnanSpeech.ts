import { recordingUrl } from './minnan'

let currentAudio: HTMLAudioElement | undefined
let nextTimer: number | undefined
let playbackId = 0

export function hasMinnanRecording(terms: string[]): boolean {
  return terms.length > 0 && terms.every((term) => Boolean(recordingUrl(term)))
}

export async function speakMinnan(terms: string[], onEnd: () => void): Promise<void> {
  stopMinnanSpeech()
  if (!hasMinnanRecording(terms)) throw new Error('MINNAN_RECORDING_UNAVAILABLE')
  const id = playbackId

  const playAt = async (index: number): Promise<void> => {
    if (id !== playbackId) return
    if (index >= terms.length) { onEnd(); return }
    const audio = new Audio(recordingUrl(terms[index])!)
    currentAudio = audio
    audio.onerror = onEnd
    audio.onended = () => {
      nextTimer = window.setTimeout(() => void playAt(index + 1), 180)
    }
    await audio.play()
  }
  await playAt(0)
}

export function stopMinnanSpeech() {
  playbackId += 1
  if (nextTimer) window.clearTimeout(nextTimer)
  nextTimer = undefined
  if (!currentAudio) return
  currentAudio.pause()
  currentAudio.currentTime = 0
  currentAudio = undefined
}

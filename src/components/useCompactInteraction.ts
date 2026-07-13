import { useEffect, useState } from 'react'

export function useCompactInteraction() {
  const query = '(max-width: 820px), (hover: none) and (pointer: coarse)'
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return compact
}

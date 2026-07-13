export type IconName = 'search' | 'home' | 'plus' | 'route' | 'person' | 'edit' | 'speaker' | 'trash'

export function Icon({ name }: { name: IconName }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    edit: <><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></>,
    speaker: <><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}


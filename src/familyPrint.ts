import type { FamilyData } from './types'

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function serializeFamilySvg(data: FamilyData, title: string) {
  const left = Math.min(...data.people.map((person) => person.x))
  const top = Math.min(...data.people.map((person) => person.y))
  const right = Math.max(...data.people.map((person) => person.x + 148))
  const bottom = Math.max(...data.people.map((person) => person.y + 94))
  const byId = new Map(data.people.map((person) => [person.id, person]))
  const relations = [
    ...data.parents.map((edge) => {
      const parent = byId.get(edge.parentId)!
      const child = byId.get(edge.childId)!
      const dashed = edge.kind && edge.kind !== 'biological' ? ' stroke-dasharray="3 3"' : ''
      return `<path d="M ${parent.x + 74} ${parent.y + 74} V ${(parent.y + child.y + 74) / 2} H ${child.x + 74} V ${child.y}"${dashed}/>`
    }),
    ...data.spouses.map((edge) => {
      const a = byId.get(edge.personAId)!
      const b = byId.get(edge.personBId)!
      return `<line x1="${a.x + 148}" y1="${a.y + 37}" x2="${b.x}" y2="${b.y + 37}"/>`
    }),
  ]
  const nodes = data.people.map((person) => `<g transform="translate(${person.x} ${person.y})"><rect width="148" height="74"/><text x="74" y="29" text-anchor="middle">${xml(person.name)}</text><text class="meta" x="74" y="51" text-anchor="middle">${person.birthYear}${person.living === false ? ' — 已故' : ''}</text></g>`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left - 30} ${top - 58} ${right - left + 60} ${bottom - top + 88}" role="img" aria-label="${xml(title)}">
<style>svg{background:#f5f1e8}path,line{fill:none;stroke:#8d4a3c;stroke-width:1.3}line{stroke:#765844;stroke-dasharray:4 4}rect{fill:#faf7f0;stroke:#756b5f;stroke-width:1;rx:5}text{fill:#28251f;font:600 13px Songti SC,Noto Serif SC,serif}.meta{fill:#766e64;font-size:9px;font-weight:400}.title{fill:#812a20;font-size:18px}</style>
<text class="title" x="${left}" y="${top - 24}">${xml(title)}</text>
${relations.join('\n')}
${nodes.join('\n')}
</svg>`
}


export interface MinnanPronunciation {
  label: string
  audioTerms: string[]
  kind: 'term' | 'path'
}

export const minnanRecordings: Record<string, { romanization: string; file: string }> = {
  家己: { romanization: 'ka-kī', file: '5899(1).mp3' },
  阿爸: { romanization: 'a-pah', file: '4558(1).mp3' },
  阿母: { romanization: 'a-bú', file: '4524(1).mp3' },
  翁: { romanization: 'ang', file: '6486(1).mp3' },
  某: { romanization: 'bóo', file: '5067(1).mp3' },
  後生: { romanization: 'hāu-senn', file: '4924(1).mp3' },
  查某囝: { romanization: 'tsa-bóo-kiánn', file: '5098(1).mp3' },
  阿兄: { romanization: 'a-hiann', file: '4520(1).mp3' },
  小弟: { romanization: 'sió-tī', file: '320(1).mp3' },
  阿姊: { romanization: 'a-tsí', file: '4555(1).mp3' },
  小妹: { romanization: 'sió-muē', file: '353(1).mp3' },
  阿公: { romanization: 'a-kong', file: '4508(1).mp3' },
  阿媽: { romanization: 'a-má', file: '4621(1).mp3' },
  外公: { romanization: 'guā-kong', file: '1428(1).mp3' },
  外媽: { romanization: 'guā-má', file: '1565(1).mp3' },
  阿伯: { romanization: 'a-peh', file: '4539(1).mp3' },
  阿叔: { romanization: 'a-tsik', file: '4550(1).mp3' },
  阿姑: { romanization: 'a-koo', file: '4556(1).mp3' },
  阿舅: { romanization: 'a-kū', file: '4626(1).mp3' },
  阿姨: { romanization: 'a-î', file: '4567(1).mp3' },
  新婦: { romanization: 'sin-pū', file: '9532(1).mp3' },
  孫仔: { romanization: 'sun-á', file: '5904(1).mp3' },
  查某孫: { romanization: 'tsa-bóo-sun', file: '5101(1).mp3' },
  囝婿: { romanization: 'kiánn-sài', file: '2222(1).mp3' },
  外孫: { romanization: 'guā-sun', file: '1512(1).mp3' },
  弟婦仔: { romanization: 'tē-hū-á', file: '3179(1).mp3' },
  阿嫂: { romanization: 'a-só', file: '4622(1).mp3' },
  姊夫: { romanization: 'tsí-hu', file: '3770(1).mp3' },
  妹婿: { romanization: 'muē-sài', file: '3796(1).mp3' },
  姪仔: { romanization: 'ti̍t-á', file: '4829(1).mp3' },
  外甥: { romanization: 'guē-sing', file: '1555(1).mp3' },
  外甥女: { romanization: 'guē-sing-lú', file: '30264(1).mp3' },
  丈人: { romanization: 'tiūnn-lâng', file: '210(1).mp3' },
  丈姆: { romanization: 'tiūnn-ḿ', file: '349(1).mp3' },
  大家官: { romanization: 'ta-ke-kuann', file: '415(1).mp3' },
  大家: { romanization: 'ta-ke', file: '411(1).mp3' },
  阿妗: { romanization: 'a-kīm', file: '4541(1).mp3' },
  阿嬸: { romanization: 'a-tsím', file: '4656(1).mp3' },
  姑丈: { romanization: 'koo-tiūnn', file: '3768(1).mp3' },
  姨丈: { romanization: 'î-tiūnn', file: '4826(1).mp3' },
  阿祖: { romanization: 'a-tsóo', file: '4588(1).mp3' },
  祖公: { romanization: 'tsóo-kong', file: '6382(1).mp3' },
  祖媽: { romanization: 'tsóo-má', file: '6412(1).mp3' },
  親家: { romanization: 'tshin-ke', file: '11928(1).mp3' },
  親家公: { romanization: 'tshin-ke-kong', file: '11929(1).mp3' },
  親姆: { romanization: 'tshenn-ḿ', file: '11922(1).mp3' },
}

const edgeTerms: Record<string, string> = {
  f: '阿爸', m: '阿母', h: '翁', w: '某', s: '後生', d: '查某囝',
  ob: '阿兄', lb: '小弟', os: '阿姊', ls: '小妹',
}

const directTerms: Record<string, string> = {
  '': '家己', f: '阿爸', m: '阿母', h: '翁', w: '某', s: '後生', d: '查某囝',
  ob: '阿兄', lb: '小弟', os: '阿姊', ls: '小妹',
  'f,f': '阿公', 'f,m': '阿媽', 'm,f': '外公', 'm,m': '外媽',
  'f,ob': '阿伯', 'f,lb': '阿叔', 'f,os': '阿姑', 'f,ls': '阿姑',
  'm,ob': '阿舅', 'm,lb': '阿舅', 'm,os': '阿姨', 'm,ls': '阿姨',
  's,w': '新婦', 's,s': '孫仔', 's,d': '查某孫', 'd,h': '囝婿', 'd,s': '外孫', 'd,d': '外孫',
  'ob,w': '阿嫂', 'lb,w': '弟婦仔', 'os,h': '姊夫', 'ls,h': '妹婿',
  'ob,s': '姪仔', 'ob,d': '姪仔', 'lb,s': '姪仔', 'lb,d': '姪仔',
  'os,s': '外甥', 'ls,s': '外甥', 'os,d': '外甥女', 'ls,d': '外甥女',
  'w,f': '丈人', 'w,m': '丈姆', 'h,f': '大家官', 'h,m': '大家',
  'f,ob,w': '阿姆', 'f,lb,w': '阿嬸', 'm,ob,w': '阿妗', 'm,lb,w': '阿妗',
  'f,os,h': '姑丈', 'f,ls,h': '姑丈', 'm,os,h': '姨丈', 'm,ls,h': '姨丈',
  'f,f,f': '阿祖', 'f,f,m': '阿祖', 'f,m,f': '阿祖', 'f,m,m': '阿祖',
  'm,f,f': '阿祖', 'm,f,m': '阿祖', 'm,m,f': '阿祖', 'm,m,m': '阿祖',
  's,w,f': '親家公', 'd,h,f': '親家公', 's,w,m': '親姆', 'd,h,m': '親姆',
}

export function formattedMinnanTerm(term: string): string {
  const recording = minnanRecordings[term]
  return recording ? `${term}（${recording.romanization}）` : term
}

export function resolveMinnan(codes: string[]): MinnanPronunciation {
  const direct = directTerms[codes.join(',')]
  if (direct && minnanRecordings[direct]) return { label: formattedMinnanTerm(direct), audioTerms: [direct], kind: 'term' }

  const audioTerms = codes.map((code) => edgeTerms[code]).filter(Boolean)
  if (audioTerms.length === codes.length && audioTerms.length) {
    return { label: audioTerms.map(formattedMinnanTerm).join(' → '), audioTerms, kind: 'path' }
  }
  return { label: '关系暂未连通', audioTerms: [], kind: 'path' }
}

export function recordingUrl(term: string): string | undefined {
  const file = minnanRecordings[term]?.file
  return file ? `/audio/minnan/moe/${file}` : undefined
}

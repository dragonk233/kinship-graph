import type { FamilyData } from './types'

export const initialFamily: FamilyData = {
  people: [
    { id: 'p-gf', name: '王德山', gender: 'male', birthYear: 1942, generation: 0, x: 220, y: 80, note: '祖籍泉州南安' },
    { id: 'p-gm', name: '陈秀莲', gender: 'female', birthYear: 1946, generation: 0, x: 420, y: 80 },
    { id: 'm-gf', name: '林宗海', gender: 'male', birthYear: 1940, generation: 0, x: 900, y: 80 },
    { id: 'm-gm', name: '黄月娥', gender: 'female', birthYear: 1945, generation: 0, x: 1100, y: 80 },

    { id: 'uncle', name: '王建成', gender: 'male', birthYear: 1966, generation: 1, x: 90, y: 290 },
    { id: 'father', name: '王建国', gender: 'male', birthYear: 1970, generation: 1, x: 310, y: 290 },
    { id: 'aunt', name: '王建芳', gender: 'female', birthYear: 1974, generation: 1, x: 530, y: 290 },
    { id: 'mother', name: '林秀英', gender: 'female', birthYear: 1972, generation: 1, x: 760, y: 290 },
    { id: 'maternal-uncle', name: '林志强', gender: 'male', birthYear: 1976, generation: 1, x: 980, y: 290 },
    { id: 'uncle-wife', name: '许慧玲', gender: 'female', birthYear: 1977, generation: 1, x: 1200, y: 290 },

    { id: 'cousin', name: '王子轩', gender: 'male', birthYear: 1994, generation: 2, x: 150, y: 500 },
    { id: 'sister', name: '王晓晴', gender: 'female', birthYear: 1996, generation: 2, x: 430, y: 500 },
    { id: 'me', name: '王晓明', gender: 'male', birthYear: 1999, generation: 2, x: 650, y: 500, note: '默认主视角' },
    { id: 'wife', name: '苏雅婷', gender: 'female', birthYear: 2000, generation: 2, x: 870, y: 500 },
    { id: 'maternal-cousin', name: '林可欣', gender: 'female', birthYear: 2002, generation: 2, x: 1140, y: 500 },

    { id: 'daughter', name: '王予安', gender: 'female', birthYear: 2025, generation: 3, x: 760, y: 710 },
  ],
  parents: [
    { parentId: 'p-gf', childId: 'uncle' }, { parentId: 'p-gm', childId: 'uncle' },
    { parentId: 'p-gf', childId: 'father' }, { parentId: 'p-gm', childId: 'father' },
    { parentId: 'p-gf', childId: 'aunt' }, { parentId: 'p-gm', childId: 'aunt' },
    { parentId: 'm-gf', childId: 'mother' }, { parentId: 'm-gm', childId: 'mother' },
    { parentId: 'm-gf', childId: 'maternal-uncle' }, { parentId: 'm-gm', childId: 'maternal-uncle' },
    { parentId: 'uncle', childId: 'cousin' },
    { parentId: 'father', childId: 'sister' }, { parentId: 'mother', childId: 'sister' },
    { parentId: 'father', childId: 'me' }, { parentId: 'mother', childId: 'me' },
    { parentId: 'maternal-uncle', childId: 'maternal-cousin' }, { parentId: 'uncle-wife', childId: 'maternal-cousin' },
    { parentId: 'me', childId: 'daughter' }, { parentId: 'wife', childId: 'daughter' },
  ],
  spouses: [
    { personAId: 'p-gf', personBId: 'p-gm' },
    { personAId: 'm-gf', personBId: 'm-gm' },
    { personAId: 'father', personBId: 'mother' },
    { personAId: 'maternal-uncle', personBId: 'uncle-wife' },
    { personAId: 'me', personBId: 'wife' },
  ],
}

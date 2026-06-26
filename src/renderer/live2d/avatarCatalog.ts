export type AvatarId = 'hiyori' | 'chitose' | 'haru' | 'mao' | 'mark' | 'natori' | 'ren' | 'rice' | 'wanko'

export interface AvatarDefinition {
  id: AvatarId
  name: string
  modelPath: string
}

export const avatarCatalog: AvatarDefinition[] = [
  {
    id: 'hiyori',
    name: 'Hiyori',
    modelPath: 'live2d/models/hiyori_free/runtime/hiyori_free_t08.model3.json'
  },
  {
    id: 'chitose',
    name: 'Chitose',
    modelPath: 'live2d/models/chitose/runtime/chitose.model3.json'
  },
  {
    id: 'haru',
    name: 'Haru',
    modelPath: 'live2d/models/Haru/Haru.model3.json'
  },
  {
    id: 'mao',
    name: 'Mao',
    modelPath: 'live2d/models/Mao/Mao.model3.json'
  },
  {
    id: 'mark',
    name: 'Mark',
    modelPath: 'live2d/models/Mark/Mark.model3.json'
  },
  {
    id: 'natori',
    name: 'Natori',
    modelPath: 'live2d/models/Natori/Natori.model3.json'
  },
  {
    id: 'ren',
    name: 'Ren',
    modelPath: 'live2d/models/Ren/Ren.model3.json'
  },
  {
    id: 'rice',
    name: 'Rice',
    modelPath: 'live2d/models/Rice/Rice.model3.json'
  },
  {
    id: 'wanko',
    name: 'Wanko',
    modelPath: 'live2d/models/Wanko/Wanko.model3.json'
  }
]

export const defaultAvatarId: AvatarId = 'hiyori'

export function getAvatarDefinition(id: AvatarId): AvatarDefinition {
  return avatarCatalog.find((avatar) => avatar.id === id) ?? avatarCatalog[0]
}

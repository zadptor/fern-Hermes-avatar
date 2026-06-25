export type AvatarId = 'hiyori' | 'chitose'

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
  }
]

export const defaultAvatarId: AvatarId = 'hiyori'

export function getAvatarDefinition(id: AvatarId): AvatarDefinition {
  return avatarCatalog.find((avatar) => avatar.id === id) ?? avatarCatalog[0]
}

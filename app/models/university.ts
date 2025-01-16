import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Province from '#models/province'

export default class University extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @belongsTo(() => Province, {
    foreignKey: 'provinceId',
  })
  declare province: BelongsTo<typeof Province>

  @column()
  declare isActive: boolean
}

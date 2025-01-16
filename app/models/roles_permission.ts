import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'
import Permission from '#models/permission'

export default class RolesPermission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare permissionId: number

  @belongsTo(() => Permission, {
    foreignKey: 'permissionId',
  })
  declare permission: BelongsTo<typeof Permission>

  @column()
  declare roleId: number

  @belongsTo(() => Role, {
    foreignKey: 'roleId',
  })
  declare role: BelongsTo<typeof Role>

  @column.dateTime({ autoCreate: true, serializeAs: null })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  declare updatedAt: DateTime
}

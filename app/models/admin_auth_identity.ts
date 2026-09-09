import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AdminAuthIdentity extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare adminUserId: number
  @column() declare provider: string
  @column() declare providerSubject: string
  @column() declare email: string
  @column.dateTime() declare lastUsedAt: DateTime | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null
}

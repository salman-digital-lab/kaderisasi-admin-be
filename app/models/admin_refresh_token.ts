import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AdminRefreshToken extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare familyId: string
  @column() declare adminUserId: number
  @column() declare tokenHash: string
  @column() declare parentTokenId: number | null
  @column() declare replacedByTokenId: number | null
  @column() declare userAgent: string | null
  @column() declare ipAddress: string | null
  @column.dateTime() declare expiresAt: DateTime
  @column.dateTime() declare lastUsedAt: DateTime | null
  @column.dateTime() declare revokedAt: DateTime | null
  @column() declare revocationReason: string | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
}

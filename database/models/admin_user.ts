import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'

export default class AdminUser extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare normalizedEmail: string

  @column()
  declare displayName: string

  @column()
  declare roleCode: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @beforeSave()
  static normalizeEmail(user: AdminUser): void {
    if (user.$dirty.email) {
      user.email = user.email.trim().toLowerCase()
      user.normalizedEmail = user.email
    }
  }
  @beforeSave()
  static async hashPassword(user: AdminUser): Promise<void> {
    if (user.$dirty.password && user.password) user.password = await hash.make(user.password)
  }
}

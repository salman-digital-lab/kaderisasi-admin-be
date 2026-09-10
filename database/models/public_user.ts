import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import hash from '@adonisjs/core/services/hash'

export default class PublicUser extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string | null

  @column()
  declare memberId: string | null

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare accountStatus: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
  @beforeSave()
  static async hashPassword(user: PublicUser): Promise<void> {
    if (user.$dirty.password && user.password) user.password = await hash.make(user.password)
  }
}

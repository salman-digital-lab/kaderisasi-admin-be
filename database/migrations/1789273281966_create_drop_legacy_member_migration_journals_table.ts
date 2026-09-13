import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.raw('DROP TABLE IF EXISTS legacy_member_migrations')
  }

  async down(): Promise<void> {
    throw new Error('Deleted migration audit data cannot be restored by rollback')
  }
}

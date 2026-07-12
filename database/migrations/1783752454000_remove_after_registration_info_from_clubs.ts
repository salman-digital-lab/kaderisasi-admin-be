import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      UPDATE clubs
      SET registration_info = COALESCE(registration_info, '{}'::jsonb) - 'after_registration_info'
    `)

    await this.db.rawQuery(`
      ALTER TABLE clubs
      ALTER COLUMN registration_info SET DEFAULT '{"registration_info": ""}'::jsonb
    `)
  }

  async down() {
    await this.db.rawQuery(`
      UPDATE clubs
      SET registration_info = COALESCE(registration_info, '{}'::jsonb)
        || '{"after_registration_info": ""}'::jsonb
    `)

    await this.db.rawQuery(`
      ALTER TABLE clubs
      ALTER COLUMN registration_info
      SET DEFAULT '{"registration_info": "", "after_registration_info": ""}'::jsonb
    `)
  }
}

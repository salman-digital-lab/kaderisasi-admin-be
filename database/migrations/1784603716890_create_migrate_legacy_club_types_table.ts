import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clubs'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE clubs
        SET club_type = CASE club_type
          WHEN 'UKM' THEN 'UNIT'
          WHEN 'AVISMAN' THEN 'AVISMAN_REGIONAL'
          ELSE club_type
        END
      `)

      await db.rawQuery(`
        ALTER TABLE clubs
        ALTER COLUMN club_type SET DEFAULT 'UNIT'
      `)

      await db.rawQuery(`
        ALTER TABLE clubs
        ADD CONSTRAINT clubs_club_type_check
        CHECK (
          club_type IN ('UNIT', 'CLUB_KEPROFESIAN', 'CLUB_BAHASA', 'AVISMAN_REGIONAL')
        )
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE clubs
        DROP CONSTRAINT IF EXISTS clubs_club_type_check
      `)

      await db.rawQuery(`
        UPDATE clubs
        SET club_type = CASE club_type
          WHEN 'AVISMAN_REGIONAL' THEN 'AVISMAN'
          ELSE 'UKM'
        END
      `)

      await db.rawQuery(`
        ALTER TABLE clubs
        ALTER COLUMN club_type SET DEFAULT 'UKM'
      `)
    })
  }
}

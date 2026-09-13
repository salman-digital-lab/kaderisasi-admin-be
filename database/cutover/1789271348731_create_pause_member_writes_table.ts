import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.defer(async (db) => {
      await db.rawQuery(`CREATE FUNCTION legacy_member_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF current_setting('application_name', true) IS DISTINCT FROM 'legacy-member-maintenance' THEN
            RAISE EXCEPTION 'MEMBER_MAINTENANCE' USING ERRCODE = '55000';
          END IF;
          RETURN NULL;
        END $$`)
      for (const table of ['public_users', 'profiles', 'legacy_members']) {
        await db.rawQuery(`CREATE TRIGGER legacy_member_write_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${table}
          FOR EACH STATEMENT EXECUTE FUNCTION legacy_member_write_guard()`)
      }
    })
  }

  async down(): Promise<void> {
    this.defer(async (db) => {
      for (const table of ['public_users', 'profiles', 'legacy_members']) {
        await db.rawQuery(`DROP TRIGGER IF EXISTS legacy_member_write_guard ON ${table}`)
      }
      await db.rawQuery('DROP FUNCTION IF EXISTS legacy_member_write_guard()')
    })
  }
}

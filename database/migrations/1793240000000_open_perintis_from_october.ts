import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The first Perintis reporting month moves from November to October 2026, so
 * its lapbul opens 1 November 2026. The month CHECKs were created unnamed, so
 * they are found by their definition.
 */
const TABLES = ['perintis_journals', 'perintis_session_reports']

function replaceMonthCheck(table: string, firstMonth: string) {
  return `
    DO $$
    DECLARE name text;
    BEGIN
      FOR name IN
        SELECT c.conname FROM pg_constraint c
        WHERE c.conrelid = '${table}'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%month%2026-1%'
      LOOP
        EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', name);
      END LOOP;
    END $$;

    ALTER TABLE ${table}
      ADD CONSTRAINT ${table}_month_check
      CHECK (extract(day FROM month) = 1 AND month >= DATE '${firstMonth}');
  `
}

export default class extends BaseSchema {
  async up() {
    this.schema.raw(TABLES.map((t) => replaceMonthCheck(t, '2026-10-01')).join('\n'))
  }

  async down() {
    this.schema.raw(`
      DELETE FROM perintis_journals WHERE month < DATE '2026-11-01';
      DELETE FROM perintis_session_reports WHERE month < DATE '2026-11-01';
    `)
    this.schema.raw(TABLES.map((t) => replaceMonthCheck(t, '2026-11-01')).join('\n'))
  }
}

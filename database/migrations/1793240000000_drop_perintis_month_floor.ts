import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The programme's first reporting month is a business rule kept in code
 * (FirstMonth in the Go APIs, FIRST_MONTH in the Perintis frontend), so the
 * database only checks that a month is the 1st. The month CHECKs were created
 * unnamed, so they are found by their definition.
 */
const TABLES = ['perintis_journals', 'perintis_session_reports']

function replaceMonthCheck(table: string, check: string) {
  return `
    DO $$
    DECLARE name text;
    BEGIN
      FOR name IN
        SELECT c.conname FROM pg_constraint c
        WHERE c.conrelid = '${table}'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%EXTRACT(day FROM month)%'
      LOOP
        EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', name);
      END LOOP;
    END $$;

    ALTER TABLE ${table} ADD CONSTRAINT ${table}_month_check ${check};
  `
}

export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      TABLES.map((t) => replaceMonthCheck(t, 'CHECK (extract(day FROM month) = 1)')).join('\n')
    )
  }

  async down() {
    // NOT VALID keeps any earlier months already recorded.
    this.schema.raw(
      TABLES.map((t) =>
        replaceMonthCheck(
          t,
          "CHECK (extract(day FROM month) = 1 AND month >= DATE '2026-11-01') NOT VALID"
        )
      ).join('\n')
    )
  }
}

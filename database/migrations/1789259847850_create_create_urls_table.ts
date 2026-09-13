import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.raw(`
      CREATE TABLE IF NOT EXISTS urls (
        id VARCHAR(10) PRIMARY KEY,
        original_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        visit_count BIGINT NOT NULL DEFAULT 0
      );
      DO $$
      BEGIN
        IF (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'urls'
          AND is_nullable = 'NO' AND (
            (column_name = 'id' AND data_type = 'character varying' AND character_maximum_length = 10)
            OR (column_name = 'original_url' AND data_type = 'text')
            OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND column_default IN ('now()', 'CURRENT_TIMESTAMP'))
            OR (column_name = 'visit_count' AND data_type = 'bigint' AND column_default IN ('0', '0::bigint'))
          )) <> 4
          OR NOT EXISTS (
            SELECT 1 FROM pg_constraint c JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
            WHERE c.conrelid = 'urls'::regclass AND c.contype = 'p'
              AND array_length(c.conkey, 1) = 1 AND a.attname = 'id'
          ) THEN
          RAISE EXCEPTION 'Existing urls table is incompatible; no data was changed';
        END IF;
        IF EXISTS (SELECT 1 FROM urls WHERE id = 'health') THEN
          RAISE EXCEPTION 'Existing health short code conflicts with the readiness endpoint';
        END IF;
      END $$;
    `)
  }

  async down(): Promise<void> {
    // Short links may predate Ace ownership and must survive application rollback.
  }
}

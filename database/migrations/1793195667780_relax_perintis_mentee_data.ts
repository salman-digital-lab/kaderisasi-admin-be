import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A mentee may be enrolled before their NIM, kategori and KIP-K are known
 * (Super Admin "Tambah peserta"); staff fill them in later. Drops the CHECK
 * that required all three for every mentee. Kategori values and the
 * (university_id, nim) uniqueness are unchanged. The constraint was created
 * unnamed, so it is found by its definition.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$
      DECLARE name text;
      BEGIN
        SELECT c.conname INTO name
        FROM pg_constraint c
        WHERE c.conrelid = 'perintis_participants'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%nim IS NOT NULL%category IS NOT NULL%kip_k IS NOT NULL%';
        IF name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE perintis_participants DROP CONSTRAINT %I', name);
        END IF;
      END $$;
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE perintis_participants
        ADD CONSTRAINT perintis_participants_mentee_data_check
        CHECK (NOT is_mentee OR (nim IS NOT NULL AND category IS NOT NULL AND kip_k IS NOT NULL))
    `)
  }
}

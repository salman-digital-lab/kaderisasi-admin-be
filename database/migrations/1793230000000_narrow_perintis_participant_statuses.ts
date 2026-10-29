import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Perintis participants are only active or inactive. "pending" (mentee without
 * a mentor) and "reserve" (mentor without mentees) become "active"; whether a
 * mentor is assigned is read from mentor_user_id instead. The status CHECK was
 * created unnamed, so it is found by its definition.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      UPDATE perintis_participants SET status = 'active', updated_at = now()
      WHERE status IN ('pending', 'reserve');

      DO $$
      DECLARE name text;
      BEGIN
        FOR name IN
          SELECT c.conname FROM pg_constraint c
          WHERE c.conrelid = 'perintis_participants'::regclass
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) LIKE '%status%pending%reserve%'
        LOOP
          EXECUTE format('ALTER TABLE perintis_participants DROP CONSTRAINT %I', name);
        END LOOP;
      END $$;

      ALTER TABLE perintis_participants
        ADD CONSTRAINT perintis_participants_status_check
        CHECK (status IN ('active', 'inactive'));
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE perintis_participants DROP CONSTRAINT IF EXISTS perintis_participants_status_check;
      ALTER TABLE perintis_participants
        ADD CONSTRAINT perintis_participants_status_check
        CHECK (status IN ('active', 'pending', 'reserve', 'inactive'));
    `)
  }
}

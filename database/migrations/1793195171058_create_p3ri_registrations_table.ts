import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * P3RI 1448 H committee registration (Open Recruitment). One registration per
 * member; the form definition is hardcoded in the Go APIs, so answers are stored
 * as JSON keyed by question id. Names are unqualified so the migration follows
 * the configured search path.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE p3ri_registrations (
        id serial PRIMARY KEY,
        user_id integer NOT NULL UNIQUE REFERENCES public_users(id) ON DELETE RESTRICT,
        status varchar(20) NOT NULL DEFAULT 'terdaftar',
        choices text[] NOT NULL,
        accepted_division varchar(60),
        answers jsonb NOT NULL DEFAULT '{}'::jsonb,
        files jsonb NOT NULL DEFAULT '[]'::jsonb,
        admin_note text,
        status_updated_by integer REFERENCES admin_users(id) ON DELETE SET NULL,
        status_updated_at timestamptz,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (status IN ('terdaftar','seleksi_berkas','wawancara','diterima','tidak_diterima')),
        CHECK (cardinality(choices) BETWEEN 1 AND 3),
        CHECK ((status = 'diterima') = (accepted_division IS NOT NULL)),
        CHECK (accepted_division IS NULL OR accepted_division = ANY (choices)),
        CHECK (jsonb_typeof(answers) = 'object' AND jsonb_typeof(files) = 'array')
      )
    `)
    this.schema.raw('CREATE INDEX p3ri_registrations_status_idx ON p3ri_registrations (status)')
    this.schema.raw(
      'CREATE INDEX p3ri_registrations_choices_idx ON p3ri_registrations USING gin (choices)'
    )
  }

  async down() {
    this.schema.raw('DROP TABLE p3ri_registrations')
  }
}

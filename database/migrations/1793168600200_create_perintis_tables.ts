import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pembinaan Beasiswa Perintis (docs/perintis/DB_DESIGN.md in the workspace).
 * Three new tables; no existing table is altered. Table-level CHECKs and
 * partial indexes are written as SQL because the builder cannot express them.
 * Names are unqualified so the migration follows the configured search path.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE perintis_participants (
        user_id integer PRIMARY KEY REFERENCES public_users(id) ON DELETE RESTRICT,
        is_mentee boolean NOT NULL DEFAULT false,
        is_mentor boolean NOT NULL DEFAULT false,
        is_coordinator boolean NOT NULL DEFAULT false,
        nim varchar(30),
        university_id integer REFERENCES universities(id) ON DELETE SET NULL,
        kip_k boolean,
        category varchar(20),
        kaderisasi_override varchar(20),
        kaderisasi_override_note text,
        mentor_user_id integer REFERENCES perintis_participants(user_id) ON DELETE SET NULL,
        coordinator_user_id integer REFERENCES perintis_participants(user_id) ON DELETE SET NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        inactive_reason text,
        updated_by integer REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (university_id, nim),
        CHECK (is_mentee OR is_mentor OR is_coordinator),
        CHECK (NOT is_mentee OR (nim IS NOT NULL AND category IS NOT NULL AND kip_k IS NOT NULL)),
        CHECK (is_mentee OR (nim IS NULL AND mentor_user_id IS NULL)),
        CHECK (is_mentor OR coordinator_user_id IS NULL),
        CHECK (category IS NULL OR category IN ('dasar','biaya_hidup')),
        CHECK (kaderisasi_override IS NULL OR kaderisasi_override IN ('lmd_lama','lmd_242','setara','belum')),
        CHECK (mentor_user_id IS NULL OR mentor_user_id <> user_id),
        CHECK (status IN ('active','pending','reserve','inactive')),
        CHECK ((status = 'inactive') = (inactive_reason IS NOT NULL))
      )
    `)
    this.schema.raw(
      'CREATE INDEX perintis_participants_mentor_idx ON perintis_participants (mentor_user_id) WHERE is_mentee'
    )
    this.schema.raw(
      'CREATE INDEX perintis_participants_coordinator_idx ON perintis_participants (coordinator_user_id) WHERE is_mentor'
    )

    this.schema.raw(`
      CREATE TABLE perintis_journals (
        id serial PRIMARY KEY,
        mentee_user_id integer NOT NULL REFERENCES perintis_participants(user_id) ON DELETE RESTRICT,
        month date NOT NULL CHECK (extract(day FROM month) = 1 AND month >= DATE '2026-11-01'),
        mentor_user_id integer REFERENCES perintis_participants(user_id) ON DELETE SET NULL,
        category varchar(20) NOT NULL,
        form_version integer NOT NULL,
        status varchar(25) NOT NULL DEFAULT 'draft',
        answers jsonb NOT NULL DEFAULT '{}'::jsonb,
        files jsonb NOT NULL DEFAULT '[]'::jsonb,
        pulse_energy smallint,
        pulse_academic smallint,
        pulse_finance smallint,
        pulse_relation smallint,
        wants_contact boolean NOT NULL DEFAULT false,
        honesty_confirmed_at timestamptz,
        submitted_at timestamptz,
        is_late boolean NOT NULL DEFAULT false,
        revision integer NOT NULL DEFAULT 1,
        reopened_by integer REFERENCES admin_users(id) ON DELETE SET NULL,
        reopen_reason text,
        response_appreciation text,
        response_text text,
        revision_request text,
        flag_reason text,
        responded_by integer REFERENCES public_users(id) ON DELETE SET NULL,
        responded_at timestamptz,
        response_read_at timestamptz,
        ai_assisted boolean NOT NULL DEFAULT false,
        flag_trigger varchar(20),
        flag_status varchar(20),
        flag_due_at timestamptz,
        flag_handled_by integer REFERENCES public_users(id) ON DELETE SET NULL,
        flag_handled_at timestamptz,
        flag_private_note text,
        followup_by integer REFERENCES admin_users(id) ON DELETE SET NULL,
        followup_at timestamptz,
        followup_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (mentee_user_id, month),
        CHECK (category IN ('dasar','biaya_hidup')),
        CHECK (status IN ('draft','submitted','accepted','revision_requested','revised','flagged')),
        CHECK (jsonb_typeof(answers) = 'object' AND jsonb_typeof(files) = 'array'),
        CHECK (status = 'draft' OR (submitted_at IS NOT NULL AND honesty_confirmed_at IS NOT NULL)),
        CHECK (pulse_energy BETWEEN 1 AND 5 AND pulse_academic BETWEEN 1 AND 5
               AND pulse_finance BETWEEN 1 AND 5 AND pulse_relation BETWEEN 1 AND 5),
        CHECK ((reopened_by IS NULL) = (reopen_reason IS NULL)),
        CHECK (status NOT IN ('accepted','revision_requested','flagged')
               OR (response_appreciation IS NOT NULL AND response_text IS NOT NULL AND responded_at IS NOT NULL)),
        CHECK (status <> 'revision_requested' OR revision_request IS NOT NULL),
        CHECK (status <> 'flagged' OR flag_reason IS NOT NULL),
        CHECK ((flag_trigger IS NULL) = (flag_status IS NULL) AND (flag_trigger IS NULL) = (flag_due_at IS NULL)),
        CHECK (flag_trigger IS NULL OR flag_trigger IN ('low_pulse','contact_request','both')),
        CHECK (flag_status IS NULL OR flag_status IN ('open','handled','escalated','resolved')),
        CHECK ((flag_status = 'handled') = (flag_handled_at IS NOT NULL)),
        CHECK (flag_status IS DISTINCT FROM 'resolved' OR followup_at IS NOT NULL),
        CHECK ((followup_at IS NULL) = (followup_note IS NULL))
      )
    `)
    this.schema.raw(
      'CREATE INDEX perintis_journals_mentor_month_idx ON perintis_journals (mentor_user_id, month, status)'
    )
    this.schema.raw(
      'CREATE INDEX perintis_journals_month_status_idx ON perintis_journals (month, status)'
    )
    this.schema.raw(
      "CREATE INDEX perintis_journals_open_flag_idx ON perintis_journals (flag_due_at) WHERE flag_status IN ('open','escalated')"
    )
    this.schema.raw(`
      CREATE INDEX perintis_journals_followup_idx ON perintis_journals (submitted_at)
        WHERE (status = 'flagged' OR flag_status = 'escalated') AND followup_at IS NULL
    `)

    this.schema.raw(`
      CREATE TABLE perintis_session_reports (
        id serial PRIMARY KEY,
        mentor_user_id integer NOT NULL REFERENCES perintis_participants(user_id) ON DELETE RESTRICT,
        month date NOT NULL CHECK (extract(day FROM month) = 1 AND month >= DATE '2026-11-01'),
        session_date date,
        mode varchar(10) NOT NULL DEFAULT 'luring',
        location_or_link varchar(500),
        curriculum_code varchar(20),
        deviation_reason text,
        summary text,
        photos jsonb NOT NULL DEFAULT '[]'::jsonb,
        case_note text,
        case_status varchar(10),
        followup_by integer REFERENCES admin_users(id) ON DELETE SET NULL,
        followup_at timestamptz,
        followup_note text,
        status varchar(20) NOT NULL DEFAULT 'draft',
        submitted_at timestamptz,
        is_late boolean NOT NULL DEFAULT false,
        review_appreciation text,
        review_note text,
        reviewer_kind varchar(10),
        reviewed_by integer,
        reviewed_at timestamptz,
        review_read_at timestamptz,
        verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (mentor_user_id, month),
        CHECK (mode IN ('luring','daring')),
        CHECK (jsonb_typeof(photos) = 'array'),
        CHECK (status IN ('draft','submitted','returned','verified')),
        CHECK (status = 'draft'
               OR (submitted_at IS NOT NULL AND session_date IS NOT NULL AND jsonb_array_length(photos) > 0)),
        CHECK ((status = 'verified') = (verified_at IS NOT NULL)),
        CHECK (status NOT IN ('returned','verified')
               OR (review_appreciation IS NOT NULL AND review_note IS NOT NULL AND reviewed_at IS NOT NULL)),
        CHECK (reviewer_kind IS NULL OR reviewer_kind IN ('public','admin')),
        CHECK ((case_note IS NULL) = (case_status IS NULL)),
        CHECK (case_status IS NULL OR case_status IN ('open','resolved')),
        CHECK ((case_status = 'resolved') = (followup_at IS NOT NULL AND followup_note IS NOT NULL))
      )
    `)
    this.schema.raw(
      'CREATE INDEX perintis_session_reports_month_idx ON perintis_session_reports (month, status)'
    )
    this.schema.raw(
      "CREATE INDEX perintis_session_reports_open_case_idx ON perintis_session_reports (created_at) WHERE case_status = 'open'"
    )
  }

  async down() {
    this.schema.raw('DROP TABLE perintis_session_reports')
    this.schema.raw('DROP TABLE perintis_journals')
    this.schema.raw('DROP TABLE perintis_participants')
  }
}

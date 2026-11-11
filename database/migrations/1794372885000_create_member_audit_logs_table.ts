import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Audit trail of admin changes to member data (Go admin API). One row per
 * write; `changes` maps a field to {"before","after"} (a password is only
 * {"changed":true}, never a value). Rows are only ever inserted.
 *
 * profile_id, user_id and actor_admin_user_id carry no foreign keys and the
 * names are stored as snapshots, so the trail survives a deleted member or
 * admin account. Names are unqualified so the migration follows the configured
 * search path.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TABLE member_audit_logs (
        id bigserial PRIMARY KEY,
        profile_id integer,
        user_id integer,
        member_name varchar(255) NOT NULL DEFAULT '',
        action varchar(40) NOT NULL,
        changes jsonb NOT NULL DEFAULT '{}'::jsonb,
        source varchar(40) NOT NULL DEFAULT 'admin',
        actor_admin_user_id integer,
        actor_name varchar(255) NOT NULL DEFAULT '',
        request_id varchar(100),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT member_audit_logs_action_check CHECK (action IN ('created','profile_updated','regional_assignment_updated','credentials_updated','account_generated','deleted')),
        CONSTRAINT member_audit_logs_changes_check CHECK (jsonb_typeof(changes) = 'object'),
        CONSTRAINT member_audit_logs_subject_check CHECK (profile_id IS NOT NULL OR user_id IS NOT NULL)
      )
    `)
    this.schema.raw(
      'CREATE INDEX member_audit_logs_profile_idx ON member_audit_logs (profile_id, id DESC)'
    )
    this.schema.raw(
      'CREATE INDEX member_audit_logs_user_idx ON member_audit_logs (user_id, id DESC)'
    )
  }

  async down() {
    this.schema.raw('DROP TABLE member_audit_logs')
  }
}

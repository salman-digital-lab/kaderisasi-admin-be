import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('certificate_templates', (table) => {
      table.string('lifecycle_status', 20).notNullable().defaultTo('draft')
      table.integer('version').notNullable().defaultTo(1)
      table.integer('background_asset_version').notNullable().defaultTo(0)
      table.timestamp('published_at').nullable()
      table.timestamp('archived_at').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE certificate_templates
        SET lifecycle_status = CASE
              WHEN is_active IS FALSE THEN 'archived'
              ELSE 'published'
            END,
            published_at = CASE
              WHEN is_active IS FALSE THEN NULL
              ELSE COALESCE(updated_at, created_at, NOW())
            END,
            archived_at = CASE
              WHEN is_active IS FALSE THEN COALESCE(updated_at, created_at, NOW())
              ELSE NULL
            END
      `)

      await db.rawQuery(`
        ALTER TABLE certificate_templates
        ADD CONSTRAINT certificate_templates_lifecycle_status_check
        CHECK (lifecycle_status IN ('draft', 'published', 'archived'))
      `)
    })

    this.schema.alterTable('activities', (table) => {
      table
        .integer('certificate_template_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('certificate_templates')
        .onDelete('RESTRICT')
      table.index(['certificate_template_id'], 'idx_activities_certificate_template')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE activities AS activity
        SET certificate_template_id = (activity.additional_config->>'certificate_template_id')::integer
        WHERE activity.certificate_template_id IS NULL
          AND activity.additional_config->>'certificate_template_id' ~ '^[1-9][0-9]*$'
          AND EXISTS (
            SELECT 1
            FROM certificate_templates AS template
            WHERE template.id = (activity.additional_config->>'certificate_template_id')::integer
          )
      `)
    })

    this.schema.alterTable('issued_certificates', (table) => {
      table.jsonb('activity_snapshot').nullable()
      table.integer('snapshot_version').notNullable().defaultTo(1)
      table.integer('template_version').notNullable().defaultTo(1)
      table
        .integer('revoked_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')
      table.index(['activity_id', 'issued_at'], 'idx_issued_certificates_activity_issued_at')
      table.index(['user_id', 'issued_at'], 'idx_issued_certificates_user_issued_at')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE issued_certificates AS certificate
        SET activity_snapshot = jsonb_build_object(
              'id', certificate.activity_id,
              'name', COALESCE(certificate.participant_snapshot->>'activity_name', activity.name, ''),
              'activity_start', CASE
                WHEN activity.activity_start IS NULL THEN NULL
                ELSE to_char(activity.activity_start, 'YYYY-MM-DD')
              END
            ),
            template_version = COALESCE(
              (
                SELECT template.version
                FROM certificate_templates AS template
                WHERE template.id = certificate.template_id
              ),
              1
            ),
            participant_snapshot = COALESCE(certificate.participant_snapshot, '{}'::jsonb)
              || jsonb_build_object(
                'gender', COALESCE(
                  (
                    SELECT profile.gender
                    FROM profiles AS profile
                    WHERE profile.user_id = certificate.user_id
                    LIMIT 1
                  ),
                  (
                    SELECT registration.guest_data->>'gender'
                    FROM activity_registrations AS registration
                    WHERE registration.id = certificate.registration_id
                  ),
                  ''
                )
              )
        FROM activities AS activity
        WHERE activity.id = certificate.activity_id
      `)

      await db.rawQuery(`
        ALTER TABLE issued_certificates
        DROP CONSTRAINT IF EXISTS issued_certificates_registration_id_foreign
      `)
      await db.rawQuery(`
        ALTER TABLE issued_certificates
        ADD CONSTRAINT issued_certificates_registration_id_foreign
        FOREIGN KEY (registration_id)
        REFERENCES activity_registrations(id)
        ON DELETE RESTRICT
      `)
      await db.rawQuery(`
        ALTER TABLE issued_certificates
        ALTER COLUMN activity_snapshot SET NOT NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE issued_certificates
        DROP CONSTRAINT IF EXISTS issued_certificates_registration_id_foreign
      `)
      await db.rawQuery(`
        ALTER TABLE issued_certificates
        ADD CONSTRAINT issued_certificates_registration_id_foreign
        FOREIGN KEY (registration_id)
        REFERENCES activity_registrations(id)
        ON DELETE CASCADE
      `)
    })

    this.schema.alterTable('issued_certificates', (table) => {
      table.dropIndex(['activity_id', 'issued_at'], 'idx_issued_certificates_activity_issued_at')
      table.dropIndex(['user_id', 'issued_at'], 'idx_issued_certificates_user_issued_at')
      table.dropColumn('activity_snapshot')
      table.dropColumn('snapshot_version')
      table.dropColumn('template_version')
      table.dropColumn('revoked_by')
    })

    this.schema.alterTable('activities', (table) => {
      table.dropIndex(['certificate_template_id'], 'idx_activities_certificate_template')
      table.dropColumn('certificate_template_id')
    })

    this.schema.alterTable('certificate_templates', (table) => {
      table.dropColumn('lifecycle_status')
      table.dropColumn('version')
      table.dropColumn('background_asset_version')
      table.dropColumn('published_at')
      table.dropColumn('archived_at')
    })
  }
}

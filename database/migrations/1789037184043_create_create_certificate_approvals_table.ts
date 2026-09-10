import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'certificate_approvals'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('registration_id')
        .notNullable()
        .references('id')
        .inTable('activity_registrations')
        .onDelete('RESTRICT')
      table
        .integer('activity_id')
        .notNullable()
        .references('id')
        .inTable('activities')
        .onDelete('RESTRICT')
      table
        .integer('signer_id')
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('RESTRICT')
      table
        .integer('requested_by')
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('RESTRICT')
      table.string('signer_name', 255).notNullable()
      table.string('signer_title', 120).notNullable()
      table.jsonb('snapshot').notNullable()
      table.string('content_hash', 64).notNullable()
      table.string('status', 20).notNullable().defaultTo('pending')
      table
        .integer('decided_by')
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('RESTRICT')
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.string('reason', 500).nullable()
      table
        .integer('certificate_id')
        .nullable()
        .references('id')
        .inTable('issued_certificates')
        .onDelete('RESTRICT')
      table.index(['signer_id', 'status', 'id'])
      table.index(['activity_id', 'status', 'id'])

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
    this.schema.raw(
      "CREATE UNIQUE INDEX certificate_approvals_pending_registration ON certificate_approvals (registration_id) WHERE status = 'pending'"
    )
    this.schema.raw(
      "ALTER TABLE certificate_approvals ADD CONSTRAINT certificate_approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))"
    )
    this.schema.raw(
      "ALTER TABLE certificate_approvals ADD CONSTRAINT certificate_approvals_decision_check CHECK ((status = 'pending' AND decided_at IS NULL AND decided_by IS NULL AND certificate_id IS NULL) OR (status = 'approved' AND decided_at IS NOT NULL AND decided_by = signer_id AND certificate_id IS NOT NULL) OR (status IN ('rejected', 'cancelled') AND decided_at IS NOT NULL AND decided_by IS NOT NULL AND certificate_id IS NULL))"
    )
    this.schema.alterTable('issued_certificates', (table) => {
      table.jsonb('approval_snapshot').nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable('issued_certificates', (table) => table.dropColumn('approval_snapshot'))
    this.schema.dropTable(this.tableName)
  }
}

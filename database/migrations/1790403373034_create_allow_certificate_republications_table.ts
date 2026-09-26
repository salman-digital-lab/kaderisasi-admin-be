import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`CREATE UNIQUE INDEX issued_certificates_active_registration_unique
      ON issued_certificates (registration_id) WHERE revoked_at IS NULL`)
    this.schema.raw(`ALTER TABLE issued_certificates
      DROP CONSTRAINT issued_certificates_registration_id_unique`)
  }

  async down() {
    // Refuse rollback if publication history contains multiple versions; never delete history.
    this.schema.raw(`ALTER TABLE issued_certificates
      ADD CONSTRAINT issued_certificates_registration_id_unique UNIQUE (registration_id)`)
    this.schema.raw('DROP INDEX issued_certificates_active_registration_unique')
  }
}

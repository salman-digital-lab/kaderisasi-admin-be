import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * P3RI registrations only use two statuses: terdaftar and diterima. Rows still
 * in a removed status go back to terdaftar. Names are unqualified so the
 * migration follows the configured search path.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      "UPDATE p3ri_registrations SET status = 'terdaftar' WHERE status NOT IN ('terdaftar','diterima')"
    )
    this.schema.raw(
      'ALTER TABLE p3ri_registrations DROP CONSTRAINT p3ri_registrations_status_check'
    )
    this.schema.raw(
      "ALTER TABLE p3ri_registrations ADD CONSTRAINT p3ri_registrations_status_check CHECK (status IN ('terdaftar','diterima'))"
    )
  }

  async down() {
    this.schema.raw(
      'ALTER TABLE p3ri_registrations DROP CONSTRAINT p3ri_registrations_status_check'
    )
    this.schema.raw(
      "ALTER TABLE p3ri_registrations ADD CONSTRAINT p3ri_registrations_status_check CHECK (status IN ('terdaftar','seleksi_berkas','wawancara','diterima','tidak_diterima'))"
    )
  }
}

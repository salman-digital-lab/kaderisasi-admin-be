import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('talent_assessment_drafts', (table) => {
      table.integer('admin_user_id').primary().references('admin_users.id').onDelete('CASCADE')
      table.text('draft_id').notNullable().unique()
      table.text('definition_version').notNullable()
      table.jsonb('answers').notNullable()
      table.integer('current_question').notNullable().defaultTo(1)
      table.integer('revision').notNullable().defaultTo(1)
      table.check('current_question BETWEEN 1 AND 170')
      table.check('revision > 0')
      table.check("jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) = 170")
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable('talent_assessment_results', (table) => {
      table.integer('admin_user_id').primary().references('admin_users.id').onDelete('CASCADE')
      table.text('submission_id').notNullable().unique()
      table.text('definition_version').notNullable()
      table.jsonb('answers').notNullable()
      table.jsonb('result').notNullable()
      table.check("jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) = 170")
      table.timestamp('submitted_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('talent_assessment_results')
    this.schema.dropTable('talent_assessment_drafts')
  }
}

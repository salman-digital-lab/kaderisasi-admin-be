import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('courses', (table) => {
      table.increments('id')
      table.string('title', 255).notNullable()
      table.text('summary').notNullable().defaultTo('')
      table.text('description').notNullable().defaultTo('')
      table.integer('minimum_level').notNullable().defaultTo(0)
      table.string('status', 20).notNullable().defaultTo('draft')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.check('minimum_level IN (0, 3, 6, 10)')
      table.check("status IN ('draft', 'published', 'archived')")
      table.index(['status', 'minimum_level', 'id'])
    })
    this.schema.createTable('course_lessons', (table) => {
      table.increments('id')
      table.integer('course_id').notNullable().references('courses.id').onDelete('CASCADE')
      table.string('title', 255).notNullable()
      table.text('description').notNullable().defaultTo('')
      table.string('youtube_video_id', 11).notNullable().defaultTo('')
      table.integer('position').notNullable()
      table.timestamp('deleted_at', { useTz: true })
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.check('position > 0')
      table.index(['course_id', 'deleted_at', 'position', 'id'])
    })
    this.schema.createTable('course_documents', (table) => {
      table.increments('id')
      table.integer('lesson_id').notNullable().references('course_lessons.id').onDelete('CASCADE')
      table.string('storage_key', 255).notNullable().unique()
      table.string('filename', 255).notNullable()
      table.integer('size_bytes').notNullable()
      table.timestamp('deleted_at', { useTz: true })
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.check('size_bytes > 0 AND size_bytes <= 20971520')
      table.index(['lesson_id', 'deleted_at'])
    })
    this.schema.createTable('course_lesson_progress', (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('public_users.id').onDelete('CASCADE')
      table.integer('lesson_id').notNullable().references('course_lessons.id').onDelete('CASCADE')
      table.timestamp('first_visited_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('last_visited_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('completed_at', { useTz: true })
      table.unique(['user_id', 'lesson_id'])
      table.index(['lesson_id', 'user_id'])
      table.index(['user_id', 'last_visited_at'])
    })
  }

  async down() {
    this.schema.dropTable('course_lesson_progress')
    this.schema.dropTable('course_documents')
    this.schema.dropTable('course_lessons')
    this.schema.dropTable('courses')
  }
}

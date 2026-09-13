import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'club_courses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('club_id').notNullable().references('clubs.id').onDelete('CASCADE')
      table.integer('course_id').notNullable().references('courses.id').onDelete('CASCADE')
      table.integer('position').notNullable()
      table.unique(['club_id', 'course_id'])
      table.check('position > 0')
      table.index(['course_id'])
    })
    this.schema.raw(`CREATE VIEW club_course_progress AS
      SELECT ar.club_id, ar.id AS registration_id, ac.course_id, ac.position,
        totals.total_lessons, progress.completed_lessons,
        CASE WHEN ar.member_id IS NULL THEN 'unverifiable'
          WHEN totals.total_lessons = 0 THEN 'empty'
          WHEN progress.completed_lessons = totals.total_lessons THEN 'completed'
          WHEN progress.visited_lessons > 0 THEN 'in_progress'
          ELSE 'not_started' END AS status
      FROM club_registrations ar
      JOIN club_courses ac ON ac.club_id = ar.club_id
      CROSS JOIN LATERAL (
        SELECT count(*)::integer AS total_lessons FROM course_lessons l
        WHERE l.course_id = ac.course_id AND l.deleted_at IS NULL
      ) totals
      CROSS JOIN LATERAL (
        SELECT count(*)::integer AS visited_lessons,
          count(*) FILTER (WHERE p.completed_at IS NOT NULL)::integer AS completed_lessons
        FROM course_lesson_progress p JOIN course_lessons l ON l.id = p.lesson_id
        WHERE p.user_id = ar.member_id AND l.course_id = ac.course_id AND l.deleted_at IS NULL
      ) progress`)
  }

  async down() {
    this.schema.raw('DROP VIEW club_course_progress')
    this.schema.dropTable(this.tableName)
  }
}

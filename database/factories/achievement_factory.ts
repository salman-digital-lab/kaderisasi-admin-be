import factory from '@adonisjs/lucid/factories'
import Achievement from '#models/achievement'
import PublicUser from '#models/public_user'
import AdminUser from '#models/admin_user'
import { DateTime } from 'luxon'
export const AchievementFactory = factory
  .define(Achievement, async ({ faker }) => {
    const users = await PublicUser.query().select('id')
    const admins = await AdminUser.query().select('id')
    
    return {
      user_id: users[Math.floor(Math.random() * (users.length - 1))].id,
      name: faker.person.fullName(),
      description: faker.lorem.paragraphs(),
      achievement_date: DateTime.fromJSDate(faker.date.recent()),
      type: faker.number.int({ min: 0, max: 1 }),
      score: faker.number.int({ min: 0, max: 100 }),
      proof: faker.image.url(),
      status: faker.number.int({ min: 0, max: 4 }),
      approver_id: admins[Math.floor(Math.random() * (admins.length - 1))].id,
      approved_at: DateTime.fromJSDate(faker.date.recent()),
    }
  })
  .build()

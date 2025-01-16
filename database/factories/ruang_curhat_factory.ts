import factory from '@adonisjs/lucid/factories'
import RuangCurhat from '#models/ruang_curhat'
import PublicUser from '#models/public_user'
import AdminUser from '#models/admin_user'

export const RuangCurhatFactory = factory
  .define(RuangCurhat, async ({ faker }) => {
    const users = await PublicUser.query().select('id')
    const admins = await AdminUser.query().select('id')
    return {
      user_id: users[Math.floor(Math.random() * (users.length - 1))].id,
      problem_ownership: faker.number.int({ min: 0, max: 1 }),
      owner_name: faker.person.fullName(),
      problem_category: faker.lorem.word(),
      problem_description: faker.lorem.paragraphs(),
      handling_technic: faker.string.fromCharacters(['Online', 'Bertemu Langsung']),
      counselor_gender: faker.string.fromCharacters(['Laki-laki', 'Perempuan']),
      counselor_id: admins[Math.floor(Math.random() * (admins.length - 1))].id,
      status: faker.number.int({ min: 0, max: 4 }),
      additional_notes: faker.lorem.paragraphs(),
    }
  })
  .build()

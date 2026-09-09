import factory from '@adonisjs/lucid/factories'
import AdminUser from '#models/admin_user'

export const AdminUserFactory = factory
  .define(AdminUser, async ({ faker }) => ({
    email: faker.internet.email(),
    password: faker.internet.password(),
    displayName: faker.person.fullName(),
    roleCode: null,
    isActive: true,
  }))
  .build()

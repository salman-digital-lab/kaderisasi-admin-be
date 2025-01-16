import factory from '@adonisjs/lucid/factories'
import AdminUser from '#models/admin_user'
import Role from '#models/role'

export const AdminUserFactory = factory
  .define(AdminUser, async ({ faker }) => {
    const roles = await Role.query().select('id')
    return {
      email: faker.internet.email(),
      password: faker.internet.password(),
      display_name: faker.internet.displayName(),
      role_id: roles[Math.floor(Math.random() * (roles.length - 1))].id,
    }
  })
  .build()

export const RealAdminUserFactory = factory
  .define(AdminUser, async () => {
    const roles = await Role.query().select('id')
    return {
      email: 'digilab@salmanitb.com',
      password: '123123123',
      display_name: 'Digilab Dev',
      role_id: roles[Math.floor(Math.random() * (roles.length - 1))].id,
    }
  })
  .build()

import factory from '@adonisjs/lucid/factories'
import AdminUser from '#models/admin_user'

export const RealAdminUserFactory = factory
  .define(AdminUser, async () => {
    return {
      email: 'digilab@salmanitb.com',
      password: '123123123',
      display_name: 'Digilab Dev',
      role: 0,
    }
  })
  .build()

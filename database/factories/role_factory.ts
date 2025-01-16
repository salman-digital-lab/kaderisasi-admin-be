import factory from '@adonisjs/lucid/factories'
import Role from '#models/role'

export const RoleFactory = factory
  // @ts-expect-error the return value type is making the error
  .define(Role, async ({ faker }) => {
    return {
      role_name: faker.string.fromCharacters(['panitia', 'counselor', 'admin']),
    }
  })
  .build()

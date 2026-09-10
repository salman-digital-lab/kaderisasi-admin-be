import factory from '@adonisjs/lucid/factories'
import PublicUser from '#models/public_user'

export const PublicUserFactory = factory
  .define(PublicUser, async ({ faker }) => {
    return {
      email: faker.internet.email(),
      password: faker.internet.password(),
    }
  })
  .build()

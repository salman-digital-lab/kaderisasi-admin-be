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

export const RealUserFactory = factory
  .define(PublicUser, async () => {
    return {
      email: 'digilab@salmanitb.com',
      password: '123123123',
    }
  })
  .build()

import factory from '@adonisjs/lucid/factories'
import Province from '#models/province'

export const ProvinceFactory = factory
  .define(Province, async ({ faker }) => {
    return {
      name: faker.location.state(),
    }
  })
  .build()

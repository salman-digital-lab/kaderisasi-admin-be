import factory from '@adonisjs/lucid/factories'
import City from '#models/city'
import Province from '#models/province'

export const CityFactory = factory
  .define(City, async ({ faker }) => {
    const provinces = await Province.query().select('id')
    return {
      province_id: provinces[Math.floor(Math.random() * (provinces.length - 1))].id,
      name: faker.location.city(),
    }
  })
  .build()

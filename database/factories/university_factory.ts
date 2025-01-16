import factory from '@adonisjs/lucid/factories'
import University from '#models/university'

export const UniversityFactory = factory
  .define(University, async ({ faker }) => {
    return {
      name: 'University of ' + faker.location.city(),
    }
  })
  .build()

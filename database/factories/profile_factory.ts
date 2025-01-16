import factory from '@adonisjs/lucid/factories'
import Profile from '#models/profile'
import Province from '#models/province'
import City from '#models/city'
import University from '#models/university'

export const ProfileFactory = factory
  .define(Profile, async ({ faker }) => {
    const name = faker.person.fullName()
    const username = name.split(' ')
    const provinces = await Province.query().select('id')
    const cities = await City.query().select('id')
    const universities = await University.query().select('id')

    return {
      name: name,
      gender: faker.string.fromCharacters(['F', 'M']),
      whatsapp: '62' + faker.string.numeric(11),
      personal_id: faker.string.numeric(15),
      line: username[0],
      instagram: username[1],
      tiktok: username[1],
      linkedin: username[1],

      province_id: provinces[Math.floor(Math.random() * (provinces.length - 1))].id,
      city_id: cities[Math.floor(Math.random() * (cities.length - 1))].id,
      university_id: universities[Math.floor(Math.random() * (universities.length - 1))].id,
      intake_year: faker.number.int({ min: 2010, max: 2023 }),
      major: faker.lorem.word(),
      level: faker.number.int({ min: 0, max: 6 }),
    }
  })
  .build()

export const RealProfileFactory = factory
  .define(Profile, async ({ faker }) => {
    const name = 'Digilab Test'
    const username = name.split(' ')
    const provinces = await Province.query().select('id')
    const cities = await City.query().select('id')
    const universities = await University.query().select('id')

    return {
      name: name,
      gender: faker.string.fromCharacters(['F', 'M']),
      whatsapp: '62' + faker.string.numeric(11),
      personal_id: faker.string.numeric(15),
      line: username[0],
      instagram: username[1],
      tiktok: username[1],
      linkedin: username[1],

      province_id: provinces[Math.floor(Math.random() * (provinces.length - 1))].id,
      city_id: cities[Math.floor(Math.random() * (cities.length - 1))].id,
      university_id: universities[Math.floor(Math.random() * (universities.length - 1))].id,
      intake_year: faker.number.int({ min: 2010, max: 2023 }),
      major: faker.lorem.word(),
      level: faker.number.int({ min: 0, max: 6 }),
    }
  })
  .build()

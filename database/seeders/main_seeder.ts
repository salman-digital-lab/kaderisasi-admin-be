import { BaseSeeder } from '@adonisjs/lucid/seeders'
import csv from 'csvtojson'

import { RealAdminUserFactory } from '#database/factories/admin_user_factory'

import Province from '#models/province'
import City from '#models/city'
import University from '#models/university'
import { AchievementFactory } from '#database/factories/achievement_factory'
import { PublicUserFactory } from '#database/factories/public_user_factory'
export default class extends BaseSeeder {
  async run() {
    const provincesArr: { code: string; name: string }[] = await csv().fromFile(
      'database/data/provinces.csv'
    )
    await Province.updateOrCreateMany(
      'id',
      provincesArr.map((item) => ({
        id: Number(item.code),
        name: item.name,
        isActive: true,
      }))
    )
    const citiesArr: { code: string; name: string; province_code: string }[] = await csv().fromFile(
      'database/data/regencies.csv'
    )
    await City.updateOrCreateMany(
      'id',
      citiesArr.map((item) => ({
        id: Number(item.code.split('.').join('')),
        provinceId: Number(item.province_code),
        name: item.name,
        isActive: true,
      }))
    )
    const universitiesArr: { ud_sp: string; kode_pt: string; nama_pt: string }[] =
      await csv().fromFile('database/data/universities.csv')
    await University.updateOrCreateMany(
      'id',
      universitiesArr.map((item, idx) => ({
        id: idx,
        name: item.nama_pt,
        isActive: true,
      }))
    )
    // Real Data Seeder
    await RealAdminUserFactory.create()

    await PublicUserFactory.createMany(10)

    await AchievementFactory.createMany(10)
  }
}

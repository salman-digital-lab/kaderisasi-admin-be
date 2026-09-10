import { BaseSeeder } from '@adonisjs/lucid/seeders'
import csv from 'csvtojson'
import Country from '#models/country'
import db from '@adonisjs/lucid/services/db'

import { AdminUserFactory } from '#database/factories/admin_user_factory'

import { AchievementFactory } from '#database/factories/achievement_factory'
import { PublicUserFactory } from '#database/factories/public_user_factory'
async function upsertReference(
  table: string,
  key: string,
  rows: Record<string, string | number | boolean>[]
): Promise<void> {
  await db.transaction(async (trx) => {
    for (let offset = 0; offset < rows.length; offset += 500) {
      await trx
        .table(table)
        .multiInsert(rows.slice(offset, offset + 500))
        .knexQuery.onConflict(key)
        .merge()
    }
  })
}

export default class extends BaseSeeder {
  async run() {
    const provincesArr: { code: string; name: string }[] = await csv().fromFile(
      'database/data/provinces.csv'
    )
    await upsertReference(
      'provinces',
      'id',
      provincesArr.map((item) => ({
        id: Number(item.code),
        name: item.name,
        is_active: true,
      }))
    )
    const citiesArr: { code: string; name: string; province_code: string }[] = await csv().fromFile(
      'database/data/regencies.csv'
    )
    await upsertReference(
      'cities',
      'id',
      citiesArr.map((item) => ({
        id: Number(item.code.split('.').join('')),
        province_id: Number(item.province_code),
        name: item.name,
        is_active: true,
      }))
    )
    const countriesArr: { Name: string; Code: string }[] = await csv().fromFile(
      'database/data/country.csv'
    )
    await Country.updateOrCreateMany(
      'code',
      countriesArr.map((item) => ({
        name: item.Name,
        code: item.Code,
      }))
    )
    const universitiesArr: { ud_sp: string; kode_pt: string; nama_pt: string }[] =
      await csv().fromFile('database/data/universities.csv')
    await upsertReference(
      'universities',
      'id',
      universitiesArr.map((item, idx) => ({
        id: idx,
        name: item.nama_pt,
        is_active: true,
      }))
    )
    // Demo account without operational access
    await AdminUserFactory.create()

    await PublicUserFactory.createMany(10)

    await AchievementFactory.createMany(10)
  }
}

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import csv from 'csvtojson'

import { ActivityFactory, FinishedActivityFactory } from '#database/factories/activity_factory'
import { PublicUserFactory } from '#database/factories/public_user_factory'
import { AdminUserFactory, RealAdminUserFactory } from '#database/factories/admin_user_factory'
import { ProfileFactory } from '#database/factories/profile_factory'
import {
  ActivityRegistrationFactory,
  ActivityRegistrationOnlyFactory,
} from '#database/factories/activity_registration_factory'
import { RuangCurhatFactory } from '#database/factories/ruang_curhat_factory'
import { RoleFactory } from '#database/factories/role_factory'
import { PermissionFactory } from '#database/factories/permission_factory'
import { RolesPermissionFactory } from '#database/factories/roles_permission_factory'
import Province from '#models/province'
import City from '#models/city'
import University from '#models/university'

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

    await ActivityFactory.createMany(10)
    await PermissionFactory.createMany(5)
    await RoleFactory.createMany(5)
    await RolesPermissionFactory.createMany(10)
    await AdminUserFactory.createMany(10)

    for (var i: number = 1; i <= 10; i++) {
      const user = await PublicUserFactory.create()
      await ProfileFactory.merge({ userId: user.id }).create()
    }

    await ActivityRegistrationOnlyFactory.createMany(200)
    await RuangCurhatFactory.createMany(10)

    await FinishedActivityFactory.createMany(5)
    await ActivityRegistrationFactory.createMany(200)

    // Real Data Seeder
    await RealAdminUserFactory.create()
  }
}

import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class DasbordAdminController {
  async stats({ response }: HttpContext) {
    try {
      const [profiles, activities, clubs, ruangCurhats] = await Promise.all([
        db.from('profiles').count('* as total').first(),
        db.from('activities').count('* as total').first(),
        db.from('clubs').count('* as total').first(),
        db.from('ruang_curhats').count('* as total').first(),
      ])

      return response.ok({
        message: 'GET_STATS_SUCCESS',
        data: {
          totalProfiles: Number(profiles?.total || 0),
          totalActivities: Number(activities?.total || 0),
          totalClubs: Number(clubs?.total || 0),
          totalRuangCurhats: Number(ruangCurhats?.total || 0),
        },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async CountProfiles({ response }: HttpContext) {
    try {
      const profiles = await db
        .from('profiles')
        .count('id as profile_amounts')
        .groupBy('level')
        .select('profiles.level')

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: profiles,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async CountUsersGender({ response }: HttpContext) {
    try {
      const profiles = await db
        .from('profiles')
        .count('id as profile_amounts')
        .groupBy('gender')
        .select('profiles.gender')

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: profiles,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class DasbordAdminController {
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

import { HttpContext } from '@adonisjs/core/http'
import Country from '#models/country'

export default class CountriesController {
  async index({ response }: HttpContext) {
    try {
      const countries = await Country.query().orderBy('name', 'asc')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: countries,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

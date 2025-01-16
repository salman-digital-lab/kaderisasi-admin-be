import { HttpContext } from '@adonisjs/core/http'
import Province from '#models/province'
import { provinceValidator } from '#validators/region_validator'

export default class ProvincesController {
  async index({ response }: HttpContext) {
    try {
      const provinces = await Province.all()

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: provinces,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const province = await Province.findOrFail(id)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: province,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const { name } = await provinceValidator.validate(request.all())
    try {
      const province = await Province.create({ name: name })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: province,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const { name } = await provinceValidator.validate(request.all())
    try {
      const id: number = params.id
      const province = await Province.findOrFail(id)
      const updated = await province.merge({ name: name }).save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: updated,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async delete({ params, response }: HttpContext) {
    const id = params.id
    try {
      const province = await Province.find(id)
      if (!province) {
        return response.ok({
          message: 'PROVINCE_NOT_FOUND',
        })
      }
      await Province.query().where('id', id).delete()
      return response.ok({
        message: 'DELETE_DATA_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

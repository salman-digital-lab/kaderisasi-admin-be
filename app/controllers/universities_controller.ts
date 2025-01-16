import { HttpContext } from '@adonisjs/core/http'
import University from '#models/university'
import { UniversityValidator } from '#validators/university_validator'

export default class UniversitiesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search

      const universities = await University.query()
        .select('*')
        .where('name', 'ILIKE', search ? '%' + search + '%' : '%%')
        .orderBy('name', 'asc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: universities,
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
      const university = await University.findOrFail(id)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: university,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const { name } = await UniversityValidator.validate(request.all())
    try {
      const university = await University.create({ name: name })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: university,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const { name } = await UniversityValidator.validate(request.all())
    try {
      const id: number = params.id
      const university = await University.findOrFail(id)
      const updated = await university.merge({ name: name }).save()

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
      const university = await University.find(id)
      if (!university) {
        return response.ok({
          message: 'UNIVERSITY_NOT_FOUND',
        })
      }
      await University.query().where('id', id).delete()
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

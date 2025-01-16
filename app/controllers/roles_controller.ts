import { HttpContext } from '@adonisjs/core/http'
import Role from '#models/role'
import { storeRoleValidator } from '#validators/role_permission_validator'

export default class RolesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10

      const roles = await Role.query().select('*').orderBy('id', 'asc').paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: roles,
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
      const role = await Role.findOrFail(id)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: role,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await storeRoleValidator.validate(request.all())
    try {
      const role = await Role.create({ roleName: payload.role_name })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: role,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await storeRoleValidator.validate(request.all())
    try {
      const id: number = params.id
      const role = await Role.findOrFail(id)
      const updated = await role.merge({ roleName: payload.role_name }).save()

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
      const role = await Role.find(id)
      if (!role) {
        return response.ok({
          message: 'ROLE_NOT_FOUND',
        })
      }
      await Role.query().where('id', id).delete()
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

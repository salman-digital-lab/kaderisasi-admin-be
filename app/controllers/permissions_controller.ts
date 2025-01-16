import { HttpContext } from '@adonisjs/core/http'
import Permission from '#models/permission'
import { storePermissionValidator } from '#validators/role_permission_validator'

export default class PermissionsController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10

      const permissions = await Permission.query()
        .select('*')
        .orderBy('permission_code', 'asc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: permissions,
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
      const permission = await Permission.findOrFail(id)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: permission,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await storePermissionValidator.validate(request.all())
    try {
      const permission = await Permission.create({ permissionCode: payload.permission_code })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: permission,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await storePermissionValidator.validate(request.all())
    try {
      const id: number = params.id
      const permission = await Permission.findOrFail(id)
      const updated = await permission.merge({ permissionCode: payload.permission_code }).save()

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
      const permission = await Permission.find(id)
      if (!permission) {
        return response.ok({
          message: 'ROLE_NOT_FOUND',
        })
      }
      await Permission.query().where('id', id).delete()
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

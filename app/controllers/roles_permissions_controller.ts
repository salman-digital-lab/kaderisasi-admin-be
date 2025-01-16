import type { HttpContext } from '@adonisjs/core/http'
import RolePermission from '#models/roles_permission'
import { storeRolesPermissionValidator } from '#validators/role_permission_validator'

export default class RolesPermissionsController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10

      const relations = await RolePermission.query()
        .select('*')
        .preload('role')
        .preload('permission')
        .orderBy('id', 'desc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: relations,
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
      const relation = await RolePermission.query()
        .where({ id: id })
        .preload('role')
        .preload('permission')
        .firstOrFail()

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: relation,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async permissionsByRole({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const relations = await RolePermission.query().where({ role_id: id }).preload('permission')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: relations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    const payload = await storeRolesPermissionValidator.validate(request.all())
    try {
      const relation = await RolePermission.create({
        roleId: payload.role_id,
        permissionId: payload.permission_id,
      })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: relation,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await storeRolesPermissionValidator.validate(request.all())
    try {
      const id: number = params.id
      const relation = await RolePermission.findOrFail(id)
      const updated = await relation
        .merge({ roleId: payload.role_id, permissionId: payload.permission_id })
        .save()

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
      const rolePermission = await RolePermission.find(id)
      if (!rolePermission) {
        return response.ok({
          message: 'ROLE_PERMISSION_NOT_FOUND',
        })
      }
      await RolePermission.query().where('id', id).delete()
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

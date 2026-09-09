import type { HttpContext } from '@adonisjs/core/http'
import { ADMIN_ROLES, serializeRole } from '#constants/admin_roles'
import { PERMISSION_CODES } from '#constants/permissions'

export default class RbacPermissionsController {
  async index({ response }: HttpContext): Promise<void> {
    response.ok({ message: 'GET_DATA_SUCCESS', data: PERMISSION_CODES })
  }

  async requestableTargets({ response }: HttpContext): Promise<void> {
    response.ok({
      message: 'GET_DATA_SUCCESS',
      data: { roles: ADMIN_ROLES.filter((role) => role.isRequestable).map(serializeRole) },
    })
  }
}

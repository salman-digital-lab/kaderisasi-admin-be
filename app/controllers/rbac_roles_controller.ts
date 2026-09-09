import type { HttpContext } from '@adonisjs/core/http'
import { ADMIN_ROLES, getAdminRole, serializeRole } from '#constants/admin_roles'

export default class RbacRolesController {
  async index({ response }: HttpContext): Promise<void> {
    response.ok({ message: 'GET_DATA_SUCCESS', data: ADMIN_ROLES.map(serializeRole) })
  }

  async show({ params, response }: HttpContext): Promise<void> {
    const role = getAdminRole(params.code)
    if (!role) {
      response.notFound({ message: 'ROLE_NOT_FOUND' })
      return
    }
    response.ok({ message: 'GET_DATA_SUCCESS', data: serializeRole(role) })
  }
}

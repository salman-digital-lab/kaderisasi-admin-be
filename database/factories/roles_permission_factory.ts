import factory from '@adonisjs/lucid/factories'
import RolesPermission from '#models/roles_permission'
import Role from '#models/role'
import Permission from '#models/permission'

export const RolesPermissionFactory = factory
  // @ts-expect-error the return value type is making the error
  .define(RolesPermission, async () => {
    const roles = await Role.query().select('id')
    const permission = await Permission.query().select('id')
    return {
      role_id: roles[Math.floor(Math.random() * (roles.length - 1))].id,
      permission_id: permission[Math.floor(Math.random() * (permission.length - 1))].id,
    }
  })
  .build()

/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import type AdminUser from '#models/admin_user'
import type { PermissionCode } from '#constants/permissions'
import type { AuthorizationSnapshot } from '#services/authorization_service'

/**
 * Delete the following ability to start from
 * scratch
 */
export const permissionAbility = Bouncer.ability(
  (user: AdminUser, permission: PermissionCode): boolean => {
    const authorization = user.$extras.authorization as AuthorizationSnapshot | undefined
    return authorization?.permissions.includes(permission) ?? false
  }
)

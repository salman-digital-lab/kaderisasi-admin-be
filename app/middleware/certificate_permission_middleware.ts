import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export type CertificatePermission =
  | 'certificate.template.read'
  | 'certificate.template.manage'
  | 'certificate.read'
  | 'certificate.issue'
  | 'certificate.revoke'

const FULL_ACCESS = new Set<CertificatePermission>([
  'certificate.template.read',
  'certificate.template.manage',
  'certificate.read',
  'certificate.issue',
  'certificate.revoke',
])

const PROGRAM_ACCESS = new Set<CertificatePermission>([
  'certificate.template.read',
  'certificate.read',
  'certificate.issue',
])

const ROLE_PERMISSIONS = new Map<number, Set<CertificatePermission>>([
  [0, FULL_ACCESS],
  [1, FULL_ACCESS],
  [2, PROGRAM_ACCESS],
  [3, PROGRAM_ACCESS],
])

export function hasCertificatePermission(role: number, permission: CertificatePermission): boolean {
  return ROLE_PERMISSIONS.get(role)?.has(permission) ?? false
}

export default class CertificatePermissionMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { permission: CertificatePermission }
  ): Promise<void> {
    const user = ctx.auth.user
    if (!user || !hasCertificatePermission(user.role, options.permission)) {
      ctx.response.forbidden({ message: 'FORBIDDEN' })
      return
    }

    await next()
  }
}

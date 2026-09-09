export const PERMISSION_CODES = [
  'dashboard.read',
  'admin_users.read',
  'admin_users.manage',
  'rbac.read',
  'tickets.review',
  'members.read',
  'members.manage',
  'members.credentials.manage',
  'activities.read',
  'activities.manage',
  'activity_registrations.read',
  'activity_registrations.manage',
  'activity_registrations.export',
  'counseling.read',
  'counseling.manage',
  'achievements.read',
  'achievements.review',
  'achievements.export',
  'leaderboards.read',
  'reference_data.manage',
  'clubs.read',
  'clubs.manage',
  'club_registrations.read',
  'club_registrations.manage',
  'club_registrations.export',
  'custom_forms.read',
  'custom_forms.manage',
  'certificate.template.read',
  'certificate.template.manage',
  'certificate.read',
  'certificate.issue',
  'certificate.revoke',
] as const

export type PermissionCode = (typeof PERMISSION_CODES)[number]

export const GOVERNANCE_PERMISSION_CODES = new Set<PermissionCode>([
  'admin_users.read',
  'admin_users.manage',
  'rbac.read',
  'tickets.review',
])

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value)
}

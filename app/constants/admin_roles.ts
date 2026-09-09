import { GOVERNANCE_PERMISSION_CODES, PERMISSION_CODES } from '#constants/permissions'
import type { PermissionCode } from '#constants/permissions'

export type AdminRoleDefinition = {
  code: string
  name: string
  description: string
  permissions: readonly PermissionCode[]
  isRequestable: boolean
}

export const ADMIN_ROLES = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Mengelola akun admin, penetapan role, dan seluruh fitur admin.',
    permissions: [],
    isRequestable: false,
  },
  {
    code: 'admin',
    name: 'Admin',
    description:
      'Mengelola konseling, anggota, kegiatan, data referensi, peringkat, formulir, klub, dan sertifikat.',
    permissions: PERMISSION_CODES.filter((code) => !GOVERNANCE_PERMISSION_CODES.has(code)),
    isRequestable: true,
  },
  {
    code: 'asmen',
    name: 'Asmen',
    description:
      'Mengelola anggota, kegiatan, prestasi, peringkat, formulir, klub, dan penerbitan sertifikat.',
    permissions: [
      'dashboard.read',
      'members.read',
      'members.manage',
      'members.credentials.manage',
      'activities.read',
      'activities.manage',
      'activity_registrations.read',
      'activity_registrations.manage',
      'activity_registrations.export',
      'achievements.read',
      'achievements.review',
      'achievements.export',
      'leaderboards.read',
      'clubs.read',
      'clubs.manage',
      'club_registrations.read',
      'club_registrations.manage',
      'club_registrations.export',
      'custom_forms.read',
      'custom_forms.manage',
      'certificate.template.read',
      'certificate.read',
      'certificate.issue',
    ],
    isRequestable: true,
  },
  {
    code: 'kapro',
    name: 'Kapro',
    description: 'Mengelola kegiatan, pendaftaran, formulir, klub, dan penerbitan sertifikat.',
    permissions: [
      'dashboard.read',
      'activities.read',
      'activities.manage',
      'activity_registrations.read',
      'activity_registrations.manage',
      'activity_registrations.export',
      'clubs.read',
      'clubs.manage',
      'club_registrations.read',
      'club_registrations.manage',
      'club_registrations.export',
      'custom_forms.read',
      'custom_forms.manage',
      'certificate.template.read',
      'certificate.read',
      'certificate.issue',
    ],
    isRequestable: true,
  },
  {
    code: 'konselor',
    name: 'Konselor',
    description: 'Melihat dan menanggapi permintaan konseling.',
    permissions: ['dashboard.read', 'counseling.read', 'counseling.manage'],
    isRequestable: true,
  },
  {
    code: 'leaderboard',
    name: 'Leaderboard',
    description: 'Meninjau dan mengekspor data prestasi serta mengelola peringkat.',
    permissions: [
      'dashboard.read',
      'achievements.read',
      'achievements.review',
      'achievements.export',
      'leaderboards.read',
    ],
    isRequestable: true,
  },
  {
    code: 'operations_admin',
    name: 'Operations Admin',
    description:
      'Mengelola seluruh fitur operasional, kecuali pengelolaan akun admin dan hak akses.',
    permissions: PERMISSION_CODES.filter((code) => !GOVERNANCE_PERMISSION_CODES.has(code)),
    isRequestable: true,
  },
  {
    code: 'member_manager',
    name: 'Member Manager',
    description: 'Mengelola profil anggota, pembuatan akun, serta email dan kata sandi anggota.',
    permissions: ['dashboard.read', 'members.read', 'members.manage', 'members.credentials.manage'],
    isRequestable: true,
  },
  {
    code: 'activity_manager',
    name: 'Activity Manager',
    description:
      'Mengelola kegiatan, peserta, ekspor data pendaftaran, formulir, dan penerbitan sertifikat.',
    permissions: [
      'dashboard.read',
      'members.read',
      'activities.read',
      'activities.manage',
      'activity_registrations.read',
      'activity_registrations.manage',
      'activity_registrations.export',
      'custom_forms.read',
      'custom_forms.manage',
      'certificate.template.read',
      'certificate.read',
      'certificate.issue',
    ],
    isRequestable: true,
  },
  {
    code: 'club_manager',
    name: 'Club Manager',
    description: 'Mengelola klub, keanggotaan, ekspor data pendaftaran, dan formulir pendaftaran.',
    permissions: [
      'dashboard.read',
      'members.read',
      'clubs.read',
      'clubs.manage',
      'club_registrations.read',
      'club_registrations.manage',
      'club_registrations.export',
      'custom_forms.read',
      'custom_forms.manage',
    ],
    isRequestable: true,
  },
  {
    code: 'certificate_manager',
    name: 'Certificate Manager',
    description:
      'Mendesain dan menerbitkan template sertifikat serta menerbitkan dan mencabut sertifikat.',
    permissions: [
      'dashboard.read',
      'members.read',
      'activities.read',
      'activity_registrations.read',
      'certificate.template.read',
      'certificate.template.manage',
      'certificate.read',
      'certificate.issue',
      'certificate.revoke',
    ],
    isRequestable: true,
  },
  {
    code: 'achievement_reviewer',
    name: 'Achievement Reviewer',
    description: 'Meninjau dan mengekspor data prestasi serta mengelola peringkat.',
    permissions: [
      'dashboard.read',
      'achievements.read',
      'achievements.review',
      'achievements.export',
      'leaderboards.read',
    ],
    isRequestable: true,
  },
  {
    code: 'counselor',
    name: 'Counselor',
    description: 'Melihat dan menanggapi permintaan konseling.',
    permissions: ['dashboard.read', 'counseling.read', 'counseling.manage'],
    isRequestable: true,
  },
  {
    code: 'reference_data_manager',
    name: 'Reference Data Manager',
    description: 'Mengelola data referensi provinsi, kota, dan perguruan tinggi.',
    permissions: ['dashboard.read', 'reference_data.manage'],
    isRequestable: true,
  },
  {
    code: 'form_manager',
    name: 'Form Manager',
    description: 'Mengelola formulir digital serta menghubungkannya dengan kegiatan dan klub.',
    permissions: [
      'dashboard.read',
      'activities.read',
      'clubs.read',
      'custom_forms.read',
      'custom_forms.manage',
    ],
    isRequestable: true,
  },
  {
    code: 'access_reviewer',
    name: 'Access Reviewer',
    description: 'Meninjau permintaan hak akses. Role ini hanya dapat ditetapkan oleh Super Admin.',
    permissions: ['dashboard.read', 'tickets.review'],
    isRequestable: false,
  },
] as const satisfies readonly AdminRoleDefinition[]

export type AdminRoleCode = (typeof ADMIN_ROLES)[number]['code']
export const ADMIN_ROLE_CODES = ADMIN_ROLES.map((role) => role.code)

export function getAdminRole(code: string | null | undefined): AdminRoleDefinition | null {
  return ADMIN_ROLES.find((role) => role.code === code) ?? null
}

export function getRolePermissions(code: string | null | undefined): PermissionCode[] {
  const role = getAdminRole(code)
  if (!role) return []
  return [...(role.code === 'super_admin' ? PERMISSION_CODES : role.permissions)].sort()
}

export function serializeRole(role: AdminRoleDefinition): {
  code: string
  name: string
  description: string
  is_requestable: boolean
  permissions: PermissionCode[]
} {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    is_requestable: role.isRequestable,
    permissions: getRolePermissions(role.code),
  }
}

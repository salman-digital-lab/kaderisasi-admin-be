import { test } from '@japa/runner'
import {
  ADMIN_ROLES,
  ADMIN_ROLE_CODES,
  getAdminRole,
  getRolePermissions,
  serializeRole,
} from '#constants/admin_roles'
import {
  GOVERNANCE_PERMISSION_CODES,
  PERMISSION_CODES,
  isPermissionCode,
} from '#constants/permissions'
import { authorizationForRole } from '#services/authorization_service'
import { parseBootstrapEmails } from '#services/admin_rbac_seed_service'
import { accessChangeError } from '#services/access_grant_service'
import { editAdminUser } from '#validators/auth_validator'
import { createAccessRequestValidator } from '#validators/ticket_validator'

test.group('Static RBAC', () => {
  test('role codes are unique and operational roles cover operational permissions only', ({
    assert,
  }) => {
    assert.equal(new Set(ADMIN_ROLE_CODES).size, ADMIN_ROLE_CODES.length)
    const covered = new Set(
      ADMIN_ROLES.filter((role) => role.isRequestable).flatMap((role) => [...role.permissions])
    )
    for (const code of PERMISSION_CODES) {
      assert.equal(covered.has(code), !GOVERNANCE_PERMISSION_CODES.has(code), code)
    }
    assert.isFalse(isPermissionCode('rbac.manage'))
    assert.isFalse(isPermissionCode('audit.read'))
  })

  test('unknown and absent roles fail closed and Super Admin receives the entire catalog', ({
    assert,
  }) => {
    for (const code of [null, undefined, 'missing', '0', 'toString']) {
      assert.deepEqual(authorizationForRole(code), {
        role: null,
        permissions: [],
        is_super_admin: false,
      })
    }
    const superAdmin = authorizationForRole('super_admin')
    assert.isTrue(superAdmin.is_super_admin)
    assert.sameMembers(superAdmin.permissions, [...PERMISSION_CODES])
    assert.deepEqual(superAdmin.role, { code: 'super_admin', name: 'Super Admin' })
  })

  test('requestable roles cannot administer accounts or review access', ({ assert }) => {
    for (const role of ADMIN_ROLES.filter((item) => item.isRequestable)) {
      assert.isFalse(
        role.permissions.some((permission) => GOVERNANCE_PERMISSION_CODES.has(permission)),
        role.code
      )
    }
    assert.isFalse(getAdminRole('super_admin')!.isRequestable)
    assert.isFalse(getAdminRole('access_reviewer')!.isRequestable)
  })

  test('issuance roles include the reads used by the certificate and participant pages', ({
    assert,
  }) => {
    for (const role of ADMIN_ROLES) {
      const permissions = getRolePermissions(role.code)
      if (!permissions.includes('certificate.issue')) continue
      for (const required of [
        'certificate.template.read',
        'certificate.read',
        'activities.read',
        'activity_registrations.read',
      ] as const) {
        assert.include(permissions, required, role.code)
      }
    }
  })

  test('catalog and authorization responses return independent permission arrays', ({ assert }) => {
    const role = getAdminRole('counselor')!
    serializeRole(role).permissions.push('admin_users.manage')
    authorizationForRole(role.code).permissions.splice(0)
    assert.sameMembers(getRolePermissions(role.code), [
      'dashboard.read',
      'counseling.read',
      'counseling.manage',
    ])
  })

  test('role-code validators accept assignment and explicit clearing but reject unknown roles', async ({
    assert,
  }) => {
    assert.deepEqual(await editAdminUser.validate({ role_code: 'club_manager' }), {
      role_code: 'club_manager',
    })
    assert.deepEqual(await editAdminUser.validate({ role_code: null }), { role_code: null })
    await assert.rejects(() => editAdminUser.validate({ role_code: 'custom_role' }))
    await assert.rejects(() =>
      createAccessRequestValidator.validate({ role_id: 1, reason: 'Need access' })
    )
    await assert.rejects(() =>
      createAccessRequestValidator.validate({ role_code: 'custom_role', reason: 'Need access' })
    )
  })

  test('last active Super Admin cannot be demoted, cleared or deactivated', ({ assert }) => {
    const current = { id: 1, role_code: 'super_admin', is_active: true }
    for (const change of [{ roleCode: 'counselor' }, { roleCode: null }, { isActive: false }]) {
      assert.equal(accessChangeError(current, change, 1), 'LAST_SUPER_ADMIN_REQUIRED')
      assert.isNull(accessChangeError(current, change, 2))
    }
    assert.isNull(accessChangeError(current, { roleCode: 'super_admin', isActive: true }, 1))
    assert.equal(accessChangeError(current, { roleCode: 'invalid' }, 2), 'UNKNOWN_ROLE')
  })

  test('former frontend role names remain assignable with their feature boundaries', async ({
    assert,
  }) => {
    const expectedNames = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      asmen: 'Asmen',
      kapro: 'Kapro',
      konselor: 'Konselor',
      leaderboard: 'Leaderboard',
    }
    for (const [code, name] of Object.entries(expectedNames)) {
      assert.equal(serializeRole(getAdminRole(code)!).name, name)
      assert.deepEqual(await editAdminUser.validate({ role_code: code }), { role_code: code })
    }
    assert.sameMembers(getRolePermissions('admin'), getRolePermissions('operations_admin'))
    assert.sameMembers(getRolePermissions('konselor'), getRolePermissions('counselor'))
    assert.sameMembers(
      getRolePermissions('leaderboard'),
      getRolePermissions('achievement_reviewer')
    )
    assert.include(getRolePermissions('asmen'), 'members.manage')
    assert.include(getRolePermissions('asmen'), 'achievements.review')
    assert.notInclude(getRolePermissions('asmen'), 'counseling.read')
    assert.notInclude(getRolePermissions('asmen'), 'reference_data.manage')
    assert.include(getRolePermissions('kapro'), 'activities.manage')
    assert.include(getRolePermissions('kapro'), 'clubs.manage')
    assert.include(getRolePermissions('kapro'), 'custom_forms.manage')
    assert.notInclude(getRolePermissions('kapro'), 'members.read')
    assert.notInclude(getRolePermissions('kapro'), 'achievements.read')
    for (const code of ['asmen', 'kapro']) {
      assert.notInclude(getRolePermissions(code), 'certificate.template.manage')
      assert.notInclude(getRolePermissions(code), 'certificate.revoke')
    }
  })

  test('bootstrap identities are normalized and deduplicated', ({ assert }) => {
    assert.deepEqual(parseBootstrapEmails(' Digilab@SalmanITB.com, ,digilab@salmanitb.com '), [
      'digilab@salmanitb.com',
    ])
    assert.deepEqual(parseBootstrapEmails(''), [])
  })
})

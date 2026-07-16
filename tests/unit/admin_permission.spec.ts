import { test } from '@japa/runner'
import { hasAdminPermission } from '#middleware/admin_permission_middleware'

test.group('Admin permissions', () => {
  test('only super admins can manage admin accounts', ({ assert }) => {
    assert.isTrue(hasAdminPermission(0, 'akunadmin'))
    assert.isFalse(hasAdminPermission(1, 'akunadmin'))
    assert.isFalse(hasAdminPermission(3, 'akunadmin'))
  })

  test('club management follows the admin frontend role policy', ({ assert }) => {
    for (const role of [0, 1, 2, 3]) {
      assert.isTrue(hasAdminPermission(role, 'club'))
      assert.isTrue(hasAdminPermission(role, 'formkustom'))
    }

    for (const role of [4, 20, undefined]) {
      assert.isFalse(hasAdminPermission(role, 'club'))
      assert.isFalse(hasAdminPermission(role, 'formkustom'))
    }
  })
})

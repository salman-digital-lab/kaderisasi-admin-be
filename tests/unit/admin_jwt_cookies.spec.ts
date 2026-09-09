import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import authConfig from '#config/auth'
import AdminUser from '#models/admin_user'

test.group('Admin JWT cookie isolation', () => {
  test('unrelated token cookies do not override the Authorization header', async ({ assert }) => {
    const resolved = await authConfig.resolver(app)
    const factory = resolved.guards.jwt
    const user = new AdminUser()
    user.id = 987654321
    user.email = 'jwt-fixture@example.com'
    const issued = await factory(await testUtils.createHttpContext()).generate(user)
    assert.property(issued, 'token')
    if (!('token' in issued)) throw new Error('Expected bearer token')

    // Stop before database lookup, and verify which identity the guard decoded.
    const originalFind = AdminUser.find
    let resolvedId: unknown
    AdminUser.find = (async (id: unknown) => {
      resolvedId = id
      return user
    }) as typeof AdminUser.find
    try {
      for (const cookie of ['token=stale', 'other_token=stale', 'admin_refresh_token=opaque']) {
        const ctx = await testUtils.createHttpContext()
        ctx.request.request.headers.authorization = `Bearer ${issued.token}`
        ctx.request.request.headers.cookie = cookie
        const authenticated = await factory(ctx).authenticate()
        assert.equal(authenticated.id, user.id)
        assert.equal(resolvedId, user.id)
      }
    } finally {
      AdminUser.find = originalFind
    }
  })
})

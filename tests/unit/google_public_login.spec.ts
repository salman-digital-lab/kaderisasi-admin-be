import { test } from '@japa/runner'
import { LoginTicket, OAuth2Client, type TokenPayload } from 'google-auth-library'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import AuthController from '#controllers/auth_controller'

test.group('Public Google login', () => {
  for (const account of [
    { email: 'person@gmail.com' },
    { email: 'person@example.org', hd: 'example.org' },
    { email: 'person@example.net' },
  ]) {
    test(`accepts verified ${account.email} without a domain restriction`, async ({ assert }) => {
      const verify = OAuth2Client.prototype.verifyIdToken
      const transaction = db.transaction
      const ctx = await testUtils.createHttpContext()
      ctx.request.validateUsing = (async () => ({
        credential: 'mock-google-credential',
      })) as typeof ctx.request.validateUsing
      const payload: TokenPayload = {
        iss: 'https://accounts.google.com',
        aud: 'fixture',
        iat: 1,
        exp: 2,
        sub: 'fixture',
        email_verified: true,
        ...account,
      }
      OAuth2Client.prototype.verifyIdToken = (async () =>
        new LoginTicket('fixture', payload)) as typeof verify
      // Stop at the database boundary: this test must not create accounts.
      db.transaction = (async () => {
        throw new Error('ACCOUNT_LOOKUP_REACHED')
      }) as typeof transaction
      try {
        await assert.rejects(() => new AuthController().google(ctx), 'ACCOUNT_LOOKUP_REACHED')
      } finally {
        OAuth2Client.prototype.verifyIdToken = verify
        db.transaction = transaction
      }
    })
  }
})

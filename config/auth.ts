import { defineConfig } from '@adonisjs/auth'
import { sessionUserProvider } from '@adonisjs/auth/session'
import { InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

import { jwtGuard } from '@maximemrf/adonisjs-jwt/jwt_config'
import { JwtGuardUser, BaseJwtContent } from '@maximemrf/adonisjs-jwt/types'
import AdminUser from '#models/admin_user'

interface JwtContent extends BaseJwtContent {
  email: string
}

const authConfig = defineConfig({
  default: 'jwt',
  guards: {
    jwt: jwtGuard({
      tokenExpiresIn: '1h',
      provider: sessionUserProvider({
        model: () => import('#models/admin_user'),
      }),
      // @ts-ignore maybe a bug from the package
      content: (user: JwtGuardUser<AdminUser>): JwtContent => ({
        userId: user.getId(),
        email: user.getOriginal().email,
      }),
    }),
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}

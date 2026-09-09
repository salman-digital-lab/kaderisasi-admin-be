import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const allowedOrigins = env
  .get('ADMIN_CORS_ORIGINS', 'http://localhost:3005')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export default class TrustedOriginMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const origin = ctx.request.header('origin')
    if (origin && !allowedOrigins.includes(origin)) {
      ctx.response.forbidden({ message: 'UNTRUSTED_ORIGIN' })
      return
    }
    await next()
  }
}

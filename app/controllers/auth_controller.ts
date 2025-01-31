import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'

import {
  registerValidator,
  loginValidator,
  editPublicUserValidator,
} from '#validators/auth_validator'
import AdminUser from '#models/admin_user'
import PublicUser from '#models/public_user'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const payload = await registerValidator.validate(request.all())
    try {
      const exist = await AdminUser.findBy('email', payload.email)

      if (exist) {
        return response.conflict({
          message: 'EMAIL_ALREADY_REGISTERED',
        })
      }

      const user = await AdminUser.create({
        displayName: payload.displayName,
        email: payload.email,
        password: payload.password,
      })

      return response.ok({
        message: 'REGISTER_SUCCESS',
        data: user,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async login({ request, response, auth }: HttpContext) {
    const payload = await loginValidator.validate(request.all())
    try {
      const email: string = payload.email
      const password: string = payload.password
      const user = await AdminUser.query().where('email', email).first()

      if (!user) {
        return response.notFound({
          message: 'USER_NOT_FOUND',
        })
      }

      if (!(await hash.verify(user.password, password))) {
        return response.unauthorized({
          message: 'WRONG_PASSWORD',
        })
      }

      const token = await auth.use('jwt').generate(user)

      return response.ok({
        message: 'LOGIN_SUCCESS',
        data: { user, token },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateMember({ params, request, response }: HttpContext) {
    const id: string = params.id
    const payload = await editPublicUserValidator.validate(request.all())

    try {
      const user = await PublicUser.findBy('id', id)
      if (!user) {
        return response.notFound({
          message: 'USER_NOT_FOUND',
        })
      }
      const exist = await PublicUser.findBy('email', payload.email)
      if (exist && exist.id !== Number(id)) {
        return response.conflict({
          message: 'EMAIL_ALREADY_REGISTERED',
        })
      }

      const updated = await user.merge(payload).save()

      return response.ok({
        message: 'UPDATE_MEMBER_SUCCESS',
        data: updated,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async logout({ response }: HttpContext) {
    try {
      return response.ok({
        message: 'LOGOUT_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

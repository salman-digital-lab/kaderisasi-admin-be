import AdminUser from '#models/admin_user'
import { editAdminUser, editPasswordValidator, registerValidator } from '#validators/auth_validator'
import type { HttpContext } from '@adonisjs/core/http'

export default class AdminusersController {
  /**
   * Display a list of resource
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search ?? ''

      const permissions = await AdminUser.query()
        .select('*')
        .where('email', 'like', `%${search}%`)
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: permissions,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Display form to create a new record
   */
  async create({ request, response }: HttpContext) {
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
        role: payload.role,
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

  /**
   * Show individual record
   */
  async show({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const permission = await AdminUser.findOrFail(id)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: permission,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await editAdminUser.validate(request.all())
    try {
      const id: number = params.id
      const admin = await AdminUser.findOrFail(id)
      const updated = await admin.merge({ role: payload.role }).save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: updated,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Edit individual record
   */
  async editPassword({ params, request, response }: HttpContext) {
    const { password } = await editPasswordValidator.validate(request.all())
    try {
      const id: number = params.id
      const user = await AdminUser.findOrFail(id)

      if (!user) {
        return response.unauthorized({
          message: 'NOT_FOUND',
        })
      }

      await user.merge({ password: password }).save()

      return response.ok({
        message: 'RESET_PASSWORD_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

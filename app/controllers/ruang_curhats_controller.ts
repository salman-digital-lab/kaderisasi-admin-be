import { HttpContext } from '@adonisjs/core/http'
import RuangCurhat from '#models/ruang_curhat'
import { UpdateRuangCurhatValidator } from '#validators/ruang_curhat_validator'

export default class RuangCurhatController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const status = request.qs().status
      const name = request.qs().name
      const gender = request.qs().gender
      const adminDisplayName = request.qs().admin_display_name

      let ruangCurhatRaw = RuangCurhat.query()
        .select('*')
        .preload('publicUser', (publicUserQuery) => {
          publicUserQuery.preload('profile')
        })
        .preload('adminUser')

      if (status) {
        ruangCurhatRaw = ruangCurhatRaw.where('status', status)
      }

      // Optimize: Combine name and gender filters in a single whereHas to reduce subqueries
      if (name || gender) {
        ruangCurhatRaw = ruangCurhatRaw
          .whereHas('publicUser', (publicUserQuery) => {
            publicUserQuery.whereHas('profile', (profileQuery) => {
              if (name) {
                profileQuery.whereILike('name', `%${name}%`)
              }
              if (gender) {
                profileQuery.where('gender', gender)
              }
            })
          })
      }

      // Filter by admin user display name
      if (adminDisplayName) {
        ruangCurhatRaw = ruangCurhatRaw
          .whereHas('adminUser', (adminUserQuery) => {
            adminUserQuery.whereILike('display_name', `%${adminDisplayName}%`)
          })
      }

      const ruangCurhat = await ruangCurhatRaw.orderBy('created_at', 'desc').paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: ruangCurhat,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const ruangCurhat = await RuangCurhat.findOrFail(id)

      await ruangCurhat.load('publicUser', (publicUserQuery) => {
        publicUserQuery.preload('profile')
      })
      await ruangCurhat.load('adminUser')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: ruangCurhat,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const payload = await UpdateRuangCurhatValidator.validate(request.all())
    try {
      const id: number = params.id
      const ruangCurhat = await RuangCurhat.findOrFail(id)
      const updated = await ruangCurhat.merge(payload).save()

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
}

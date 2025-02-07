import type { HttpContext } from '@adonisjs/core/http'
import Achievement from '#models/achievement'
import { DateTime } from 'luxon'
import { updateAchievementValidator } from '#validators/achievement_validator'

export default class LeaderboardsController {
  /**
   * Get all achievements with optional filters
   */
  async index({ request, response }: HttpContext) {
    const { page = 1, per_page: perPage = 10, status, email, type } = request.qs()

    try {
      const query = Achievement.query().preload('user').preload('approver')

      if (status !== undefined) {
        query.where('status', status)
      }
      if (email) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('email', email)
        })
      }
      if (type !== undefined) {
        query.where('type', type)
      }

      const achievements = await query.paginate(page, perPage)
      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: achievements,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Get achievement by ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const achievement = await Achievement.query()
        .where('id', params.id)
        .preload('user')
        .preload('approver')
        .firstOrFail()

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: achievement,
      })
    } catch (error) {
      return response.notFound({
        message: 'ACHIEVEMENT_NOT_FOUND',
        error: error.message,
      })
    }
  }

  /**
   * Update achievement
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const achievement = await Achievement.findOrFail(params.id)
      const validatedPayload = await request.validateUsing(updateAchievementValidator)

      const payload: Partial<{
        name: string
        description: string
        type: number
        score: number
        proof: string
        status: number
        approverId: number | null
        approvedAt: DateTime | null
      }> = validatedPayload

      // If status is being updated to approved
      if (payload.status === 1 && achievement.status !== 1) {
        payload.approverId = auth.user!.id
        payload.approvedAt = DateTime.now()
      }

      achievement.merge(payload)
      await achievement.save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: achievement,
      })
    } catch (error) {
      return response.notFound({
        message: 'ACHIEVEMENT_NOT_FOUND',
        error: error.message,
      })
    }
  }
}

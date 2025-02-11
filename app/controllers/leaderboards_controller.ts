import type { HttpContext } from '@adonisjs/core/http'
import Achievement from '#models/achievement'
import MonthlyLeaderboard from '#models/monthly_leaderboard'
import LifetimeLeaderboard from '#models/lifetime_leaderboard'
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

  /**
   * Approve or reject achievement
   */
  async approveReject({ params, request, response, auth }: HttpContext) {
    try {
      const achievement = await Achievement.findOrFail(params.id)
      const { status } = await request.validateUsing(updateAchievementValidator)

      if (typeof status !== 'number') {
        return response.badRequest({
          message: 'INVALID_STATUS',
          error: 'Status must be a number',
        })
      }

      // Update achievement status
      achievement.status = status
      achievement.approverId = auth.user!.id
      achievement.approvedAt = DateTime.now()
      await achievement.save()

      // If approved, update leaderboards
      if (status === 1) {
        // Update monthly leaderboard
        const achievementMonth = achievement.achievementDate.startOf('month')
        let monthlyLeaderboard = await MonthlyLeaderboard.query()
          .where('userId', achievement.userId)
          .where('month', achievementMonth.toSQLDate()!)
          .first()

        if (!monthlyLeaderboard) {
          monthlyLeaderboard = new MonthlyLeaderboard()
          monthlyLeaderboard.userId = achievement.userId
          monthlyLeaderboard.month = achievementMonth
          monthlyLeaderboard.score = 0
          monthlyLeaderboard.scoreAcademic = 0
          monthlyLeaderboard.scoreCompetency = 0
          monthlyLeaderboard.scoreOrganizational = 0
        }

        // Update score based on achievement type
        switch (achievement.type) {
          case 1: // Academic
            monthlyLeaderboard.scoreAcademic += achievement.score
            break
          case 2: // Competency
            monthlyLeaderboard.scoreCompetency += achievement.score
            break
          case 3: // Organizational
            monthlyLeaderboard.scoreOrganizational += achievement.score
            break
        }
        monthlyLeaderboard.score += achievement.score
        await monthlyLeaderboard.save()

        // Update lifetime leaderboard
        let lifetimeLeaderboard = await LifetimeLeaderboard.query()
          .where('userId', achievement.userId)
          .first()

        if (!lifetimeLeaderboard) {
          lifetimeLeaderboard = new LifetimeLeaderboard()
          lifetimeLeaderboard.userId = achievement.userId
          lifetimeLeaderboard.score = 0
          lifetimeLeaderboard.scoreAcademic = 0
          lifetimeLeaderboard.scoreCompetency = 0
          lifetimeLeaderboard.scoreOrganizational = 0
        }

        // Update score based on achievement type
        switch (achievement.type) {
          case 1: // Academic
            lifetimeLeaderboard.scoreAcademic += achievement.score
            break
          case 2: // Competency
            lifetimeLeaderboard.scoreCompetency += achievement.score
            break
          case 3: // Organizational
            lifetimeLeaderboard.scoreOrganizational += achievement.score
            break
        }
        lifetimeLeaderboard.score += achievement.score
        await lifetimeLeaderboard.save()
      }

      return response.ok({
        message: status === 1 ? 'ACHIEVEMENT_APPROVED' : 'ACHIEVEMENT_REJECTED',
        data: achievement,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

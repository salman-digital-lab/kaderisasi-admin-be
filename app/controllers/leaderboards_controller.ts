import type { HttpContext } from '@adonisjs/core/http'
import Achievement from '#models/achievement'
import MonthlyLeaderboard from '#models/monthly_leaderboard'
import LifetimeLeaderboard from '#models/lifetime_leaderboard'
import { DateTime } from 'luxon'
import { updateAchievementValidator } from '#validators/achievement_validator'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ExcelJS from 'exceljs'

enum ACHIEVEMENT_TYPE_ENUM {
  KOMPETENSI,
  ORGANISASI,
  AKADEMIK,
}

enum ACHIEVEMENT_STATUS_ENUM {
  PENDING,
  APPROVED,
  REJECTED,
}

const ACHIEVEMENT_EXPORT_HEADERS = [
  'No',
  'Nama Prestasi',
  'Nama',
  'Email',
  'Kategori',
  'Skor',
  'Status',
  'Tanggal Prestasi',
  'Tanggal Dibuat',
  'Disetujui Oleh',
  'Tanggal Persetujuan',
  'Catatan',
  'Deskripsi',
  'Bukti',
]

const ACHIEVEMENT_SORT_COLUMNS: Record<string, string> = {
  achievement_date: 'achievement_date',
  created_at: 'created_at',
}

export default class LeaderboardsController {
  private renderAchievementType(type: number): string {
    switch (type) {
      case ACHIEVEMENT_TYPE_ENUM.KOMPETENSI:
        return 'Kompetensi'
      case ACHIEVEMENT_TYPE_ENUM.ORGANISASI:
        return 'Organisasi'
      case ACHIEVEMENT_TYPE_ENUM.AKADEMIK:
        return 'Akademik'
      default:
        return String(type)
    }
  }

  private renderAchievementStatus(status: number): string {
    switch (status) {
      case ACHIEVEMENT_STATUS_ENUM.PENDING:
        return 'Menunggu Persetujuan'
      case ACHIEVEMENT_STATUS_ENUM.APPROVED:
        return 'Diterima'
      case ACHIEVEMENT_STATUS_ENUM.REJECTED:
        return 'Ditolak'
      default:
        return String(status)
    }
  }

  private formatDate(date?: DateTime | null): string {
    return date?.toFormat('dd LLLL yyyy') ?? ''
  }

  private buildAchievementExportRow(
    rowNumber: number,
    achievement: Achievement
  ): Array<string | number> {
    return [
      rowNumber,
      achievement.name,
      achievement.user?.profile?.name || '',
      achievement.user?.email || '',
      this.renderAchievementType(achievement.type),
      achievement.score,
      this.renderAchievementStatus(achievement.status),
      this.formatDate(achievement.achievementDate),
      this.formatDate(achievement.createdAt),
      achievement.approver?.displayName || '',
      this.formatDate(achievement.approvedAt),
      achievement.remark || '',
      achievement.description || '',
      achievement.proof || '',
    ]
  }

  /**
   * Get all achievements with optional filters
   */
  async index({ request, response }: HttpContext) {
    const {
      page = 1,
      per_page: perPage = 10,
      status,
      email,
      type,
      name,
      sort_by: sortBy = 'created_at',
      sort_order: sortOrder = 'desc',
    } = request.qs()
    const sortColumn = ACHIEVEMENT_SORT_COLUMNS[sortBy] ?? 'created_at'
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc'

    try {
      const query = Achievement.query()
        .preload('user', (userQuery) => {
          userQuery.preload('profile')
        })
        .preload('approver')

      if (status !== undefined) {
        query.where('status', status)
      }
      if (email) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('email', email)
        })
      }
      if (name) {
        query.whereHas('user', (userQuery) => {
          userQuery.whereHas('profile', (profileQuery) => {
            profileQuery.whereILike('name', `%${name}%`)
          })
        })
      }
      if (type !== undefined) {
        query.where('type', type)
      }

      query.orderBy(sortColumn, sortDirection)

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
   * Export all achievements to XLSX
   */
  async export({ response }: HttpContext) {
    try {
      const achievements = await Achievement.query()
        .preload('user', (userQuery) => {
          userQuery.preload('profile')
        })
        .preload('approver')
        .orderBy('created_at', 'desc')

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Achievements')

      worksheet.addRow(ACHIEVEMENT_EXPORT_HEADERS)

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      for (const [i, achievement] of achievements.entries()) {
        worksheet.addRow(this.buildAchievementExportRow(i + 1, achievement))
      }

      worksheet.columns.forEach((column) => {
        let maxLength = 0
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
        column.width = maxLength < 10 ? 10 : maxLength > 50 ? 50 : maxLength + 2
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const fileName = `achievements-${DateTime.now().toFormat('yyyy-LL-dd')}.xlsx`

      return response
        .status(200)
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(buffer)
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
   * Get monthly leaderboard
   */
  async monthlyLeaderboard({ request, response }: HttpContext) {
    const { page = 1, per_page: perPage = 10, month, year, email, name } = request.qs()

    try {
      const query = MonthlyLeaderboard.query().preload('user', (userQuery) => {
        userQuery.preload('profile', (profileQuery) => {
          profileQuery.preload('university')
        })
      })

      // Filter by month and year if provided
      if (month && year) {
        const targetMonth = DateTime.fromObject({
          year: Number.parseInt(year),
          month: Number.parseInt(month),
        }).startOf('month')
        query.where('month', targetMonth.toSQLDate()!)
      } else if (year) {
        const startOfYear = DateTime.fromObject({ year: Number.parseInt(year) }).startOf('year')
        const endOfYear = DateTime.fromObject({ year: Number.parseInt(year) }).endOf('year')
        query.whereBetween('month', [startOfYear.toSQLDate()!, endOfYear.toSQLDate()!])
      }

      // Filter by email if provided
      if (email) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('email', 'ILIKE', `%${email}%`)
        })
      }

      // Filter by name if provided
      if (name) {
        query.whereHas('user', (userQuery) => {
          userQuery.whereHas('profile', (profileQuery) => {
            profileQuery.where('name', 'ILIKE', `%${name}%`)
          })
        })
      }

      // Order by total score descending
      query.orderBy('score', 'desc')

      const leaderboard = await query.paginate(page, perPage)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: leaderboard,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Get lifetime leaderboard
   */
  async lifetimeLeaderboard({ request, response }: HttpContext) {
    const { page = 1, per_page: perPage = 10, email, name } = request.qs()

    try {
      const query = LifetimeLeaderboard.query().preload('user', (userQuery) => {
        userQuery.preload('profile', (profileQuery) => {
          profileQuery.preload('university')
        })
      })

      // Filter by email if provided
      if (email) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('email', 'ILIKE', `%${email}%`)
        })
      }

      // Filter by name if provided
      if (name) {
        query.whereHas('user', (userQuery) => {
          userQuery.whereHas('profile', (profileQuery) => {
            profileQuery.where('name', 'ILIKE', `%${name}%`)
          })
        })
      }

      query.orderBy('score', 'desc')

      const leaderboard = await query.paginate(page, perPage)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: leaderboard,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
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
      const { status, score, remark } = await request.validateUsing(updateAchievementValidator)

      if (typeof status !== 'number') {
        return response.badRequest({
          message: 'INVALID_STATUS',
          error: 'Status must be a number',
        })
      }

      return await db.transaction(async (trx: TransactionClientContract) => {
        // Update achievement status
        achievement.useTransaction(trx)
        achievement.status = status
        achievement.approverId = auth.user!.id
        achievement.approvedAt = DateTime.now()

        // Update score if provided
        if (score !== undefined) {
          achievement.score = score
        }

        // Add remark if rejecting
        if (status === 2 && remark) {
          achievement.remark = remark
        }

        await achievement.save()

        // If approved, update leaderboards
        if (status === 1) {
          // Update monthly leaderboard
          const achievementMonth = achievement.achievementDate.startOf('month')
          let monthlyLeaderboard = await MonthlyLeaderboard.query({ client: trx })
            .where('userId', achievement.userId)
            .where('month', achievementMonth.toSQLDate()!)
            .first()

          if (!monthlyLeaderboard) {
            monthlyLeaderboard = new MonthlyLeaderboard()
            monthlyLeaderboard.useTransaction(trx)
            monthlyLeaderboard.userId = achievement.userId
            monthlyLeaderboard.month = achievementMonth
            monthlyLeaderboard.score = 0
            monthlyLeaderboard.scoreAcademic = 0
            monthlyLeaderboard.scoreCompetition = 0
            monthlyLeaderboard.scoreOrganizational = 0
          } else {
            monthlyLeaderboard.useTransaction(trx)
          }

          // Update score based on achievement type
          switch (achievement.type) {
            case ACHIEVEMENT_TYPE_ENUM.AKADEMIK: // Academic
              monthlyLeaderboard.scoreAcademic += achievement.score
              break
            case ACHIEVEMENT_TYPE_ENUM.KOMPETENSI: // Competition
              monthlyLeaderboard.scoreCompetition += achievement.score
              break
            case ACHIEVEMENT_TYPE_ENUM.ORGANISASI: // Organizational
              monthlyLeaderboard.scoreOrganizational += achievement.score
              break
          }
          monthlyLeaderboard.score += achievement.score
          await monthlyLeaderboard.save()

          // Update lifetime leaderboard
          let lifetimeLeaderboard = await LifetimeLeaderboard.query({ client: trx })
            .where('userId', achievement.userId)
            .first()

          if (!lifetimeLeaderboard) {
            lifetimeLeaderboard = new LifetimeLeaderboard()
            lifetimeLeaderboard.useTransaction(trx)
            lifetimeLeaderboard.userId = achievement.userId
            lifetimeLeaderboard.score = 0
            lifetimeLeaderboard.scoreAcademic = 0
            lifetimeLeaderboard.scoreCompetition = 0
            lifetimeLeaderboard.scoreOrganizational = 0
          } else {
            lifetimeLeaderboard.useTransaction(trx)
          }

          // Update score based on achievement type
          switch (achievement.type) {
            case ACHIEVEMENT_TYPE_ENUM.AKADEMIK: // Academic
              lifetimeLeaderboard.scoreAcademic += achievement.score
              break
            case ACHIEVEMENT_TYPE_ENUM.KOMPETENSI: // Competition
              lifetimeLeaderboard.scoreCompetition += achievement.score
              break
            case ACHIEVEMENT_TYPE_ENUM.ORGANISASI: // Organizational
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
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

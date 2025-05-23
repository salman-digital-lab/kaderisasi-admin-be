import { HttpContext } from '@adonisjs/core/http'
import ActivityRegistration from '#models/activity_registration'
import Activity from '#models/activity'
import Profile from '#models/profile'
import db from '@adonisjs/lucid/services/db'
import {
  updateActivityRegistrations,
  bulkUpdateActivityRegistrations,
  storeActivityRegistration,
  updateActivityRegistrationsByEmail,
} from '#validators/activity_validator'

import { ACTIVITY_REGISTRANT_STATUS_ENUM } from '../../types/constants/activity.js'
import {
  ACTIVITY_LEVEL_UPGRADE_MAP,
  ACTIVITY_TYPE_SPECIAL,
} from '../constants/activity_registration.js'
import PublicUser from '#models/public_user'

export default class ActivityRegistrationsController {
  async store({ params, request, response }: HttpContext) {
    const payload = await storeActivityRegistration.validate(request.all())
    const activityId = params.id
    try {
      const userData = await Profile.findOrFail(payload.user_id)
      const activity = await Activity.findOrFail(activityId)
      const registered = await ActivityRegistration.query().where({
        user_id: userData.userId,
        activity_id: activity.id,
      })

      if (registered && registered.length) {
        return response.conflict({
          message: 'ALREADY_REGISTERED',
        })
      }

      if (userData.level < activity.minimumLevel) {
        return response.forbidden({
          message: 'UNMATCHED_LEVEL',
        })
      }
      const registration = await ActivityRegistration.create({
        userId: userData.userId,
        activityId: activity.id,
        status: 'TERDAFTAR',
        questionnaireAnswer: payload.questionnaire_answer,
      })

      return response.ok({
        messages: 'CREATE_DATA_SUCCESS',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    const registrationId: number = params.id
    try {
      const registration = await ActivityRegistration.findOrFail(registrationId)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: registration,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async index({ params, request, response }: HttpContext) {
    const activityId = params.id
    const page = request.qs().page ?? 1
    const perPage = request.qs().per_page ?? 10
    const name = request.qs().name
    const status = request.qs().status

    try {
      const activity = await Activity.findOrFail(activityId)
      const mandatoryData = activity.additionalConfig.mandatory_profile_data
      const profileDataField = mandatoryData.map((element) => {
        return 'profiles.' + element.name
      })

      const registrations = await db
        .from('activity_registrations')
        .join('public_users', 'activity_registrations.user_id', '=', 'public_users.id')
        .join('profiles', 'activity_registrations.user_id', '=', 'profiles.user_id')
        .where('activity_registrations.activity_id', activityId)
        .where('profiles.name', 'ILIKE', name ? '%' + name + '%' : '%%')
        .where('activity_registrations.status', 'ILIKE', status ? '%' + status + '%' : '%%')
        .select(
          'activity_registrations.id',
          'public_users.id as user_id',
          'public_users.email',
          'profiles.name',
          'profiles.level',
          ...profileDataField,
          'activity_registrations.status'
        )
        .orderBy('profiles.name', 'asc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: registrations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async getActivityByUserId({ response, params }: HttpContext) {
    try {
      const id = params.id
      const activities = await ActivityRegistration.query()
        .select('*')
        .where('user_id', id)
        .preload('activity')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: activities,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.stack,
      })
    }
  }

  async updateStatus({ request, response }: HttpContext) {
    const payload = await updateActivityRegistrations.validate(request.all())
    const status: string = payload.status
    const ids: number[] = payload.registrations_id
    try {
      const registration = await ActivityRegistration.findOrFail(ids[0])
      const activity = await registration.related('activity').query().firstOrFail()
      const { activityType } = activity

      // Start transaction
      const trx = await db.transaction()
      try {
        if (
          ACTIVITY_TYPE_SPECIAL.includes(activityType) &&
          status === ACTIVITY_REGISTRANT_STATUS_ENUM.LULUS_KEGIATAN
        ) {
          const userIds = (
            await ActivityRegistration.query({ client: trx })
              .select('user_id')
              .whereIn('id', ids)
              .paginate(1, ids.length)
          ).all()

          // Update level
          await Profile.query({ client: trx })
            .whereIn(
              'user_id',
              userIds.map((user) => user.userId)
            )
            .update({
              level:
                ACTIVITY_LEVEL_UPGRADE_MAP[activityType as keyof typeof ACTIVITY_LEVEL_UPGRADE_MAP],
            })

          // Update badges by appending new badge
          if (activity.badge) {
            for (const user of userIds) {
              const profile = await Profile.findByOrFail('user_id', user.userId, { client: trx })
              const currentBadges = profile.badges as unknown as string[]
              if (!currentBadges.includes(activity.badge)) {
                await profile
                  .merge({
                    badges: JSON.stringify([...currentBadges, activity.badge]),
                  })
                  .save()
              }
            }
          }
        }

        const affectedRows = await ActivityRegistration.query({ client: trx })
          .whereIn('id', ids)
          .update({ status: status })

        // Commit transaction
        await trx.commit()

        return response.ok({
          messages: 'UPDATE_DATA_SUCCESS',
          affected_rows: affectedRows,
        })
      } catch (error) {
        // Rollback transaction on error
        await trx.rollback()
        throw error
      }
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateStatusByListOfEmail({ params, request, response }: HttpContext) {
    const activityId = params.id
    const payload = await updateActivityRegistrationsByEmail.validate(request.all())
    const status: string = payload.status

    try {
      // Get activity to check activity type
      const activity = await Activity.findOrFail(activityId)
      const { activityType } = activity

      // Start transaction
      const trx = await db.transaction()

      try {
        // Get user_ids from the emails
        const users = await PublicUser.query({ client: trx })
          .whereIn('email', payload.emails)
          .select('id')

        if (users.length === 0) {
          return response.notFound({
            message: 'NO_USERS_FOUND',
          })
        }

        const userIds = users.map((user) => user.id)

        // Get registrations for these users in this activity
        const registrations = await ActivityRegistration.query({ client: trx })
          .whereIn('user_id', userIds)
          .where('activity_id', activityId)

        if (registrations.length === 0) {
          return response.notFound({
            message: 'NO_REGISTRATIONS_FOUND',
          })
        }

        // Special logic for activity types that upgrade user level
        if (
          ACTIVITY_TYPE_SPECIAL.includes(activityType) &&
          status === ACTIVITY_REGISTRANT_STATUS_ENUM.LULUS_KEGIATAN
        ) {
          // Update level
          await Profile.query({ client: trx })
            .whereIn('user_id', userIds)
            .update({
              level:
                ACTIVITY_LEVEL_UPGRADE_MAP[activityType as keyof typeof ACTIVITY_LEVEL_UPGRADE_MAP],
            })

          // Update badges by appending new badge
          if (activity.badge) {
            for (const userId of userIds) {
              const profile = await Profile.findByOrFail('user_id', userId, { client: trx })
              const currentBadges = profile.badges as unknown as string[]
              if (!currentBadges.includes(activity.badge)) {
                await profile
                  .merge({
                    badges: JSON.stringify([...currentBadges, activity.badge]),
                  })
                  .save()
              }
            }
          }
        }

        // Update the status for all matching registrations
        const affectedRows = await ActivityRegistration.query({ client: trx })
          .whereIn('user_id', userIds)
          .where('activity_id', activityId)
          .update({ status: payload.status })

        // Commit transaction
        await trx.commit()

        return response.ok({
          messages: 'UPDATE_DATA_SUCCESS',
          affected_rows: affectedRows,
        })
      } catch (error) {
        // Rollback transaction on error
        await trx.rollback()
        throw error
      }
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateStatusBulk({ params, request, response }: HttpContext) {
    const activityId = params.id
    const payload = await bulkUpdateActivityRegistrations.validate(request.all())
    const clause: {
      name?: string
      status?: string
    } = {}

    if (payload.name) clause.name = payload.name
    if (payload.current_status) clause.status = payload.current_status

    try {
      const affectedRows = await ActivityRegistration.query()
        .where('activity_id', activityId)
        .where(clause)
        .update({ status: payload.new_status })
      return response.ok({
        messages: 'UPDATE_DATA_SUCCESS',
        affected_rows: affectedRows,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async export({ params, response }: HttpContext) {
    const activityId = params.id
    try {
      const activity = await Activity.findOrFail(activityId)
      const registrations = await ActivityRegistration.query()
        .where({ activityId: activityId })
        .preload('publicUser')
        .select('*')

      if (!registrations) {
        return response.notFound({
          message: 'REGISTRATIONS_NOT_AVAILABLE',
        })
      }

      // Define headers
      const baseHeaders = [
        'No',
        'Nama Lengkap',
        'Jenis Kelamin',
        'Email',
        'Whatsapp',
        'Nomor Identitas',
        'Line ID',
        'Instagram',
        'TikTok',
        'LinkedIn',
        'Provinsi',
        'Universitas',
        'Jurusan',
        'Tahun Masuk',
        'Jenjang',
      ]

      // Improved CSV escaping function that handles all Excel edge cases
      const escapeCSV = (str: string | number | null | undefined) => {
        if (str === null || str === undefined) return '""'
        
        str = String(str)
        
        // Check if the string contains any characters that would require escaping
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          // Replace double quotes with two double quotes (Excel standard)
          str = str.replace(/"/g, '""')
          // Wrap in quotes
          return `"${str}"`
        }
        
        return str === '' ? '""' : str
      }

      const questions = activity.additionalConfig.additional_questionnaire

      // Add questionnaire headers
      const questionHeaders = questions.map((q) => q.label)
      
      // Escape all headers properly
      const allHeadersEscaped = [...baseHeaders, ...questionHeaders].map(header => escapeCSV(header))

      // Start building CSV content with UTF-8 BOM for Excel compatibility
      // The BOM (Byte Order Mark) helps Excel identify the file as UTF-8
      let csvContent = '\ufeff' + allHeadersEscaped.join(',') + '\r\n'

      // Process each registration
      for (let [i, item] of registrations.entries()) {
        let profile = await Profile.query()
          .where('user_id', item.publicUser.id)
          .preload('province')
          .preload('city')
          .preload('university')
          .firstOrFail()

        const provinceName = profile.province ? profile.province.name : ''
        const universityName = profile.university ? profile.university.name : ''

        const baseData = [
          i + 1,
          escapeCSV(profile.name),
          escapeCSV(profile.gender),
          escapeCSV(item.publicUser.email),
          escapeCSV(profile.whatsapp),
          escapeCSV(profile.personal_id),
          escapeCSV(profile.line),
          escapeCSV(profile.instagram),
          escapeCSV(profile.tiktok),
          escapeCSV(profile.linkedin),
          escapeCSV(provinceName),
          escapeCSV(universityName),
          escapeCSV(profile.major),
          escapeCSV(profile.intakeYear),
          escapeCSV(profile.level),
        ]

        // Add questionnaire answers
        const answers = item.questionnaireAnswer
        const answerValues = Object.values(questions).map((question) =>
          escapeCSV(answers[question.name])
        )

        // Combine all values and add to CSV content with Windows line endings for Excel
        const rowData = [...baseData, ...answerValues]
        csvContent += rowData.join(',') + '\r\n'
      }

      // Use the correct content type and filename for Excel compatibility
      const sanitizedFileName = activity.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      
      return response
        .status(200)
        .safeHeader('Content-type', 'text/csv; charset=utf-8')
        .safeHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}.csv"`)
        .send(csvContent)
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.stack,
      })
    }
  }

  async delete({ params, response }: HttpContext) {
    const id = params.id
    try {
      const registration = await ActivityRegistration.find(id)
      if (!registration) {
        return response.ok({
          message: 'REGISTRATION_NOT_FOUND',
        })
      }
      await ActivityRegistration.query().where('id', id).delete()
      return response.ok({
        message: 'DELETE_DATA_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

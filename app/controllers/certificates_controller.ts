import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Activity from '#models/activity'
import ActivityRegistration from '#models/activity_registration'
import CertificateTemplate from '#models/certificate_template'
import Profile from '#models/profile'
import drive from '@adonisjs/drive/services/main'

const generateCertificatesValidator = vine.compile(
  vine.object({
    activity_id: vine.number().positive(),
    template_id: vine.number().positive(),
    status: vine.string().optional(),
  })
)

const generateSingleCertificateValidator = vine.compile(
  vine.object({
    registration_id: vine.number().positive(),
  })
)

type CertificateParticipant = {
  registration_id: number
  user_id: number
  name: string
  email: string
  activity_name: string
  activity_date: string
}

export default class CertificatesController {
  async generate({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateCertificatesValidator)
      const status = payload.status || 'LULUS KEGIATAN'

      const activity = await Activity.find(payload.activity_id)
      if (!activity) {
        return response.notFound({
          message: 'ACTIVITY_NOT_FOUND',
        })
      }

      const template = await CertificateTemplate.find(payload.template_id)
      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      const participants = await ActivityRegistration.query()
        .where('activity_id', payload.activity_id)
        .where('status', status)
        .preload('publicUser', (query) => {
          query.preload('profile')
        })

      if (participants.length === 0) {
        return response.badRequest({
          message: 'NO_PARTICIPANTS_FOUND',
          error: `Tidak ada peserta dengan status ${status}`,
        })
      }

      const certificateData: CertificateParticipant[] = participants.map((registration) => {
        const profile = registration.publicUser?.profile
        return {
          registration_id: registration.id,
          user_id: registration.userId,
          name: profile?.name || registration.publicUser?.email || 'Unknown',
          email: registration.publicUser?.email || '',
          activity_name: activity.name,
          activity_date: activity.activityStart
            ? activity.activityStart.toFormat('dd MMMM yyyy')
            : '',
        }
      })

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: {
          activity,
          template,
          participants: certificateData,
          total: certificateData.length,
        },
      })
    } catch (error) {
      if (error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: error.messages,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async generateSingle({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateSingleCertificateValidator)

      const registration = await ActivityRegistration.query()
        .where('id', payload.registration_id)
        .where('status', 'LULUS KEGIATAN')
        .preload('publicUser', (query) => {
          query.preload('profile', (profileQuery) => {
            profileQuery.preload('university')
          })
        })
        .first()

      if (!registration) {
        return response.notFound({
          message: 'REGISTRATION_NOT_FOUND',
          error: 'Peserta tidak ditemukan atau status bukan LULUS KEGIATAN',
        })
      }

      const activity = await Activity.find(registration.activityId)
      if (!activity) {
        return response.notFound({
          message: 'ACTIVITY_NOT_FOUND',
        })
      }

      const templateId = activity.additionalConfig?.certificate_template_id
      if (!templateId) {
        return response.badRequest({
          message: 'NO_CERTIFICATE_TEMPLATE',
          error: ' activities ini belum memiliki template sertifikat',
        })
      }

      const template = await CertificateTemplate.find(templateId)
      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      const profile = registration.publicUser?.profile

      const certificateData = {
        registration_id: registration.id,
        user_id: registration.userId,
        name: profile?.name || registration.publicUser?.email || 'Unknown',
        email: registration.publicUser?.email || '',
        university: profile?.university?.name || '',
        activity_name: activity.name,
        activity_date: activity.activityStart
          ? activity.activityStart.toFormat('dd MMMM yyyy')
          : '',
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: {
          activity: {
            id: activity.id,
            name: activity.name,
            activity_start: activity.activityStart?.toISO(),
          },
          template: {
            id: template.id,
            name: template.name,
            background_image: template.backgroundImage,
            template_data: template.templateData,
          },
          participant: certificateData,
        },
      })
    } catch (error) {
      if (error.name === 'ValidationException') {
        return response.badRequest({
          message: 'VALIDATION_ERROR',
          errors: error.messages,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

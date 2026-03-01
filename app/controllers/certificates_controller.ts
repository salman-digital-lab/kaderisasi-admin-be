import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import {
  buildCertificateData,
  buildBulkCertificateData,
} from '#services/certificate_service'

const generateCertificatesValidator = vine.compile(
  vine.object({
    activity_id: vine.number().positive(),
    status: vine.string().optional(),
  })
)

const generateSingleCertificateValidator = vine.compile(
  vine.object({
    registration_id: vine.number().positive(),
  })
)

export default class CertificatesController {
  async generate({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(generateCertificatesValidator)
      const status = payload.status || 'LULUS KEGIATAN'

      const result = await buildBulkCertificateData(payload.activity_id, status)

      if (!result.success) {
        const httpStatus = result.error === 'ACTIVITY_NOT_FOUND' || result.error === 'CERTIFICATE_TEMPLATE_NOT_FOUND'
          ? 404
          : 400
        if (httpStatus === 404) {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: {
          activity: result.data.activity,
          template: result.data.template,
          participants: result.data.participants,
          total: result.data.participants.length,
        },
      })
    } catch (error: any) {
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

      const result = await buildCertificateData(payload.registration_id)

      if (!result.success) {
        const httpStatus = result.error === 'REGISTRATION_NOT_FOUND' || result.error === 'ACTIVITY_NOT_FOUND' || result.error === 'CERTIFICATE_TEMPLATE_NOT_FOUND'
          ? 404
          : 400
        if (httpStatus === 404) {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'CERTIFICATE_DATA_GENERATED',
        data: result.data,
      })
    } catch (error: any) {
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

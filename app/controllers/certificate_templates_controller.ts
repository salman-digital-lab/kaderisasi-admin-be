import { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import CertificateTemplate from '#models/certificate_template'
import {
  certificateTemplateValidator,
  updateCertificateTemplateValidator,
  backgroundImageValidator,
} from '#validators/certificate_template_validator'

export default class CertificateTemplatesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search
      const isActive = request.qs().is_active

      const query = CertificateTemplate.query()

      if (search) {
        query.where('name', 'ILIKE', `%${search}%`)
      }

      if (isActive !== undefined) {
        query.where('isActive', isActive === 'true')
      }

      const templates = await query.orderBy('createdAt', 'desc').paginate(page, perPage)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: templates,
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
      const template = await CertificateTemplate.find(id)

      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: template,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(certificateTemplateValidator)

      const template = await CertificateTemplate.create(payload as Partial<CertificateTemplate>)

      return response.created({
        message: 'CERTIFICATE_TEMPLATE_CREATED_SUCCESS',
        data: template,
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

  async update({ params, request, response }: HttpContext) {
    try {
      const id: number = params.id
      const template = await CertificateTemplate.find(id)

      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      const payload = await request.validateUsing(updateCertificateTemplateValidator)

      await template.merge(payload as Partial<CertificateTemplate>).save()

      return response.ok({
        message: 'CERTIFICATE_TEMPLATE_UPDATED_SUCCESS',
        data: template,
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

  async destroy({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const template = await CertificateTemplate.find(id)

      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      await template.delete()

      return response.ok({
        message: 'CERTIFICATE_TEMPLATE_DELETED_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async uploadBackground({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(backgroundImageValidator)
    const templateId = params.id

    try {
      const template = await CertificateTemplate.find(templateId)

      if (!template) {
        return response.notFound({
          message: 'CERTIFICATE_TEMPLATE_NOT_FOUND',
        })
      }

      // Delete old file if exists
      if (template.backgroundImage) {
        try {
          await drive.use().delete(template.backgroundImage)
        } catch (_error) {
          // File might not exist, continue
        }
      }

      const file = payload.file
      const fileName = `certificate_bg_${templateId}_${Date.now()}.${file.extname}`
      await file.moveToDisk(`certificate/${fileName}`)

      await template.merge({ backgroundImage: `certificate/${fileName}` }).save()

      return response.ok({
        message: 'UPLOAD_BACKGROUND_SUCCESS',
        data: { backgroundImage: `certificate/${fileName}` },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

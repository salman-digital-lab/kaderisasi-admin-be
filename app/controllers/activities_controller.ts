import { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'

import Activity, { type AdditionalConfig } from '#models/activity'
import CertificateTemplate from '#models/certificate_template'
import { hasCertificatePermission } from '#middleware/certificate_permission_middleware'
import { getCertificateTemplateReadiness } from '#services/certificate_template_readiness_service'
import { generateUniqueActivitySlug } from '#services/activity_slug_service'
import {
  activityValidator,
  updateActivityValidator,
  imageValidator,
} from '#validators/activity_validator'
import { DateTime } from 'luxon'

export default class ActivitiesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search

      const clause: {
        activity_category?: number
        minimum_level?: number
        activity_type?: number
        is_published?: number
        club_id?: number
      } = {}

      if (request.qs().category) clause.activity_category = request.qs().category

      if (request.qs().minimum_level) clause.minimum_level = request.qs().minimum_level

      if (request.qs().activity_type) clause.activity_type = request.qs().activity_type

      if (request.qs().is_published) clause.is_published = request.qs().is_published

      if (request.qs().club_id) clause.club_id = request.qs().club_id

      const activities = await Activity.query()
        .where(clause)
        .where('name', 'ILIKE', search ? '%' + search + '%' : '%%')
        .select(
          'id',
          'name',
          'activity_start',
          'activity_end',
          'registration_start',
          'registration_end',
          'selection_start',
          'selection_end',
          'activity_type',
          'activity_category',
          'club_id',
          'is_published',
          'is_registration_open'
        )
        .preload('club')
        .orderBy('isPublished', 'desc')
        .orderBy('createdAt', 'desc')
        .paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: activities,
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
      const activityData = await Activity.query().where('id', id).preload('club').first()

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: activityData,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async uploadImage({ request, params, response }: HttpContext) {
    const payload = await request.validateUsing(imageValidator)
    const activityId = params.id
    try {
      const activity = await Activity.find(activityId)
      if (!activity) {
        return response.notFound({
          message: 'ACTIVITY_NOT_FOUND',
        })
      }

      var fileNames: string[] = []
      if (activity.additionalConfig.images) {
        fileNames = activity.additionalConfig.images
      }

      const image = payload.file

      await image.moveToDisk(image.clientName || '')

      fileNames.push(image.clientName || '')
      const newConfig = activity.additionalConfig
      newConfig.images = fileNames

      await activity.merge({ additionalConfig: newConfig }).save()

      return response.ok({
        message: 'UPLOAD_IMAGE_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async deleteImage({ request, params, response }: HttpContext) {
    const activityId = params.id
    const payload = request.all()
    const index: number = payload.index
    try {
      const activity = await Activity.findOrFail(activityId)

      if (activity.additionalConfig.images.length === 0) {
        return response.notFound({
          message: 'IMAGE_NOT_FOUND',
        })
      }

      await drive.use().delete(activity.additionalConfig.images[index])

      const images: string[] = activity.additionalConfig.images
      images.splice(index, 1)
      const newConfig = activity.additionalConfig
      newConfig.images = images
      await activity.merge({ additionalConfig: newConfig }).save()

      return response.ok({
        message: 'DELETE_IMAGE_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async reorderImages({ request, params, response }: HttpContext) {
    const activityId = params.id
    const payload = request.all()
    const images: string[] = payload.images
    try {
      const activity = await Activity.findOrFail(activityId)

      if (!activity.additionalConfig.images || activity.additionalConfig.images.length === 0) {
        return response.notFound({
          message: 'IMAGE_NOT_FOUND',
        })
      }

      const newConfig = activity.additionalConfig
      newConfig.images = images
      await activity.merge({ additionalConfig: newConfig }).save()

      return response.ok({
        message: 'REORDER_IMAGES_SUCCESS',
        data: activity,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async store({ request, response, auth }: HttpContext) {
    const payload = await activityValidator.validate(request.all())
    try {
      const certificateTemplateId =
        payload.certificate_template_id ??
        payload.additional_config?.certificate_template_id ??
        null

      if (certificateTemplateId !== null) {
        if (
          !auth.user ||
          !hasCertificatePermission(auth.user.role, 'certificate.template.manage')
        ) {
          return response.forbidden({ message: 'FORBIDDEN' })
        }

        const template = await CertificateTemplate.find(certificateTemplateId)
        if (!template) {
          return response.status(422).json({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
        }

        const readiness = getCertificateTemplateReadiness(template)
        if (template.lifecycleStatus !== 'published' || !readiness.ready) {
          return response.status(422).json({
            message: 'CERTIFICATE_TEMPLATE_NOT_READY',
            errors: readiness.errors,
          })
        }
      }

      const slug = await generateUniqueActivitySlug(payload.name)
      const additionalConfig = payload.additional_config
        ? ({
            ...payload.additional_config,
            certificate_template_id: certificateTemplateId,
          } as AdditionalConfig)
        : undefined

      const activityData = await Activity.create({
        ...payload,
        slug,
        activityStart: payload.activity_start
          ? DateTime.fromJSDate(payload.activity_start)
          : undefined,
        activityEnd: payload.activity_end ? DateTime.fromJSDate(payload.activity_end) : undefined,
        registrationStart: payload.registration_start
          ? DateTime.fromJSDate(payload.registration_start)
          : undefined,
        registrationEnd: payload.registration_end
          ? DateTime.fromJSDate(payload.registration_end)
          : undefined,
        selectionStart: payload.selection_start
          ? DateTime.fromJSDate(payload.selection_start)
          : undefined,
        selectionEnd: payload.selection_end
          ? DateTime.fromJSDate(payload.selection_end)
          : undefined,
        clubId: payload.club_id ?? null,
        additionalConfig,
        certificateTemplateId,
      })

      return response.ok({
        message: 'CREATE_DATA_SUCCESS',
        data: activityData,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.stack,
      })
    }
  }

  async update({ params, request, response, auth }: HttpContext) {
    const payload = await updateActivityValidator.validate(request.all())
    try {
      const id: number = params.id
      const activityData = await Activity.findOrFail(id)
      const nestedTemplateId = payload.additional_config?.certificate_template_id
      const assignmentProvided =
        payload.certificate_template_id !== undefined || nestedTemplateId !== undefined
      const requestedTemplateId =
        payload.certificate_template_id !== undefined
          ? payload.certificate_template_id
          : nestedTemplateId

      if (assignmentProvided && requestedTemplateId !== activityData.certificateTemplateId) {
        if (
          !auth.user ||
          !hasCertificatePermission(auth.user.role, 'certificate.template.manage')
        ) {
          return response.forbidden({ message: 'FORBIDDEN' })
        }

        if (requestedTemplateId !== null && requestedTemplateId !== undefined) {
          const template = await CertificateTemplate.find(requestedTemplateId)
          if (!template) {
            return response.status(422).json({ message: 'CERTIFICATE_TEMPLATE_NOT_FOUND' })
          }

          const readiness = getCertificateTemplateReadiness(template)
          if (template.lifecycleStatus !== 'published' || !readiness.ready) {
            return response.status(422).json({
              message: 'CERTIFICATE_TEMPLATE_NOT_READY',
              errors: readiness.errors,
            })
          }
        }
      }

      const { slug: _slug, ...payloadWithoutSlug } = payload as typeof payload & { slug?: string }
      const newConfig: AdditionalConfig = {
        ...activityData.additionalConfig,
        ...(payload.additional_config ?? {}),
        ...(assignmentProvided ? { certificate_template_id: requestedTemplateId ?? null } : {}),
        images: activityData.additionalConfig.images ?? [],
      }
      const updated = await activityData
        .merge({
          ...payloadWithoutSlug,
          activityStart: payloadWithoutSlug.activity_start
            ? DateTime.fromJSDate(payloadWithoutSlug.activity_start)
            : undefined,
          activityEnd: payloadWithoutSlug.activity_end
            ? DateTime.fromJSDate(payloadWithoutSlug.activity_end)
            : undefined,
          registrationStart: payloadWithoutSlug.registration_start
            ? DateTime.fromJSDate(payloadWithoutSlug.registration_start)
            : undefined,
          registrationEnd: payloadWithoutSlug.registration_end
            ? DateTime.fromJSDate(payloadWithoutSlug.registration_end)
            : undefined,
          selectionStart: payloadWithoutSlug.selection_start
            ? DateTime.fromJSDate(payloadWithoutSlug.selection_start)
            : undefined,
          selectionEnd: payloadWithoutSlug.selection_end
            ? DateTime.fromJSDate(payloadWithoutSlug.selection_end)
            : undefined,
          ...(payloadWithoutSlug.club_id !== undefined
            ? { clubId: payloadWithoutSlug.club_id }
            : {}),
          additionalConfig: newConfig,
          ...(assignmentProvided ? { certificateTemplateId: requestedTemplateId ?? null } : {}),
        })
        .save()

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

  async delete({ params, response }: HttpContext) {
    const id = params.id
    try {
      const activity = await Activity.find(id)
      if (!activity) {
        return response.ok({
          message: 'ACTIVITY_NOT_FOUND',
        })
      }
      await Activity.query().where('id', id).delete()
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

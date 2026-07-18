import { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'

import Activity, { type AdditionalConfig } from '#models/activity'
import CertificateTemplate from '#models/certificate_template'
import { hasCertificatePermission } from '#middleware/certificate_permission_middleware'
import { getCertificateTemplateReadiness } from '#services/certificate_template_readiness_service'
import { generateUniqueActivitySlug } from '#services/activity_slug_service'
import { InvalidImageError, storeOptimizedImage } from '#services/image_upload_service'
import {
  activityValidator,
  deleteActivityImageValidator,
  reorderActivityImagesValidator,
  updateActivityValidator,
  imageValidator,
} from '#validators/activity_validator'
import { DateTime } from 'luxon'

const MAX_ACTIVITY_IMAGES = 8

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
    let uploadedKey: string | null = null

    try {
      const activity = await Activity.find(activityId)
      if (!activity) {
        return response.notFound({
          message: 'ACTIVITY_NOT_FOUND',
        })
      }

      if ((activity.additionalConfig?.images?.length ?? 0) >= MAX_ACTIVITY_IMAGES) {
        return response.conflict({
          message: 'ACTIVITY_IMAGE_LIMIT_REACHED',
        })
      }

      uploadedKey = await storeOptimizedImage(
        payload.file,
        `activity/${activity.id}/${randomUUID()}`,
        'gallery'
      )
      const storedImageKey = uploadedKey

      const result = await db.transaction(async (trx) => {
        const lockedActivity = await Activity.query({ client: trx })
          .where('id', activity.id)
          .forUpdate()
          .first()

        if (!lockedActivity) return { error: 'ACTIVITY_NOT_FOUND' } as const

        const images = [...(lockedActivity.additionalConfig?.images ?? [])]
        if (images.length >= MAX_ACTIVITY_IMAGES) {
          return { error: 'ACTIVITY_IMAGE_LIMIT_REACHED' } as const
        }

        images.push(storedImageKey)
        const additionalConfig = {
          ...lockedActivity.additionalConfig,
          images,
        }

        lockedActivity.useTransaction(trx)
        await lockedActivity.merge({ additionalConfig }).save()
        return { image: storedImageKey, images } as const
      })

      if ('error' in result) {
        await drive
          .use()
          .delete(uploadedKey)
          .catch(() => undefined)
        uploadedKey = null

        if (result.error === 'ACTIVITY_NOT_FOUND') {
          return response.notFound({ message: result.error })
        }
        return response.conflict({ message: result.error })
      }

      return response.ok({
        message: 'UPLOAD_IMAGE_SUCCESS',
        data: result,
      })
    } catch (error) {
      if (uploadedKey) {
        await drive
          .use()
          .delete(uploadedKey)
          .catch(() => undefined)
      }
      if (error instanceof InvalidImageError) {
        return response.unprocessableEntity({ message: error.message })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
      })
    }
  }

  async deleteImage({ request, params, response }: HttpContext) {
    const activityId = params.id
    const payload = await request.validateUsing(deleteActivityImageValidator)

    try {
      const result = await db.transaction(async (trx) => {
        const activity = await Activity.query({ client: trx })
          .where('id', activityId)
          .forUpdate()
          .first()

        if (!activity) return { error: 'ACTIVITY_NOT_FOUND' } as const

        const images = [...(activity.additionalConfig?.images ?? [])]
        const imageIndex = images.indexOf(payload.image)
        if (imageIndex === -1) return { error: 'IMAGE_NOT_FOUND' } as const

        const [removedImage] = images.splice(imageIndex, 1)
        const additionalConfig = {
          ...activity.additionalConfig,
          images,
        }

        activity.useTransaction(trx)
        await activity.merge({ additionalConfig }).save()
        return { images, removedImage } as const
      })

      if ('error' in result) {
        return response.notFound({ message: result.error })
      }

      await drive
        .use()
        .delete(result.removedImage)
        .catch(() => undefined)

      return response.ok({
        message: 'DELETE_IMAGE_SUCCESS',
        data: { images: result.images },
      })
    } catch {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
      })
    }
  }

  async reorderImages({ request, params, response }: HttpContext) {
    const activityId = params.id
    const payload = await request.validateUsing(reorderActivityImagesValidator)

    try {
      const result = await db.transaction(async (trx) => {
        const activity = await Activity.query({ client: trx })
          .where('id', activityId)
          .forUpdate()
          .first()

        if (!activity) return { error: 'ACTIVITY_NOT_FOUND' } as const

        const currentImages = activity.additionalConfig?.images ?? []
        const requestedImages = payload.images
        const requestedSet = new Set(requestedImages)
        const hasSameImages =
          requestedImages.length === currentImages.length &&
          requestedSet.size === currentImages.length &&
          currentImages.every((image) => requestedSet.has(image))

        if (!hasSameImages) return { error: 'INVALID_IMAGE_ORDER' } as const

        const additionalConfig = {
          ...activity.additionalConfig,
          images: [...requestedImages],
        }

        activity.useTransaction(trx)
        await activity.merge({ additionalConfig }).save()
        return { activity } as const
      })

      if ('error' in result) {
        if (result.error === 'ACTIVITY_NOT_FOUND') {
          return response.notFound({ message: result.error })
        }
        return response.badRequest({ message: result.error })
      }

      return response.ok({
        message: 'REORDER_IMAGES_SUCCESS',
        data: result.activity,
      })
    } catch {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
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

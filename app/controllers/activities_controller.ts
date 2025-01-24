import { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'

import Activity from '#models/activity'
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
      } = {}

      if (request.qs().category) clause.activity_category = request.qs().category

      if (request.qs().minimum_level) clause.minimum_level = request.qs().minimum_level

      if (request.qs().activity_type) clause.activity_type = request.qs().activity_type

      if (request.qs().is_published) clause.is_published = request.qs().is_published

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
          'is_published'
        )
        .orderBy('isPublished', 'desc')
        .orderBy('createdAt', 'asc')
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
      const activityData = await Activity.find(id)

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
      console.log(image)

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

  async store({ request, response }: HttpContext) {
    const payload = await activityValidator.validate(request.all())
    try {
      const activityData = await Activity.create({
        ...payload,
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

  async update({ params, request, response }: HttpContext) {
    const payload = await updateActivityValidator.validate(request.all())
    try {
      const id: number = params.id
      const activityData = await Activity.findOrFail(id)
      if (payload.additional_config) {
        var newConfig: any = payload.additional_config
        if (activityData.additionalConfig.images) {
          newConfig.images = activityData.additionalConfig.images
        }
      }
      payload.additional_config = newConfig
      const updated = await activityData
        .merge({
          ...payload,
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

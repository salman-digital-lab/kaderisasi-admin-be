import { HttpContext } from '@adonisjs/core/http'
import CustomForm from '#models/custom_form'
import {
  customFormValidator,
  updateCustomFormValidator,
} from '#validators/custom_form_validator'

export default class CustomFormsController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search
      const featureType = request.qs().feature_type
      const featureId = request.qs().feature_id
      const isActive = request.qs().is_active

      const query = CustomForm.query()

      // Apply filters
      if (search) {
        query.where('formName', 'ILIKE', `%${search}%`)
      }

      if (featureType) {
        query.where('featureType', featureType)
      }

      if (featureId) {
        query.where('featureId', featureId)
      }

      if (isActive !== undefined) {
        query.where('isActive', isActive === 'true')
      }

      const customForms = await query
        .orderBy('createdAt', 'desc')
        .paginate(page, perPage)

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: customForms,
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
      const customForm = await CustomForm.find(id)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: customForm,
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
      const payload = await request.validateUsing(customFormValidator)

      const customForm = await CustomForm.create(payload)

      return response.created({
        message: 'CUSTOM_FORM_CREATED_SUCCESS',
        data: customForm,
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
      const customForm = await CustomForm.find(id)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      const payload = await request.validateUsing(updateCustomFormValidator)

      await customForm.merge(payload).save()

      return response.ok({
        message: 'CUSTOM_FORM_UPDATED_SUCCESS',
        data: customForm,
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
      const customForm = await CustomForm.find(id)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      await customForm.delete()

      return response.ok({
        message: 'CUSTOM_FORM_DELETED_SUCCESS',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async getByFeature({ request, response }: HttpContext) {
    try {
      const featureType = request.qs().feature_type
      const featureId = request.qs().feature_id

      if (!featureType || !featureId) {
        return response.badRequest({
          message: 'FEATURE_TYPE_AND_ID_REQUIRED',
        })
      }

      const customForm = await CustomForm.query()
        .where('featureType', featureType)
        .where('featureId', featureId)
        .where('isActive', true)
        .first()

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND_FOR_FEATURE',
        })
      }

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: customForm,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async toggleActive({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const customForm = await CustomForm.find(id)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      customForm.isActive = !customForm.isActive
      await customForm.save()

      return response.ok({
        message: 'CUSTOM_FORM_STATUS_UPDATED',
        data: customForm,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

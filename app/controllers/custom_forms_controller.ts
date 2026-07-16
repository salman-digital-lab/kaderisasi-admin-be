import { HttpContext } from '@adonisjs/core/http'
import CustomForm from '#models/custom_form'
import Activity from '#models/activity'
import Club from '#models/club'
import {
  attachCustomFormToClubValidator,
  customFormValidator,
  updateCustomFormValidator,
} from '#validators/custom_form_validator'
import {
  attachCustomFormToClub,
  ClubFormAttachmentError,
  createCustomFormWithClubInvariant,
  updateCustomFormWithClubInvariant,
} from '#services/custom_form_club_attachment_service'

export default class CustomFormsController {
  private async isAttachedToOpenClub(customForm: CustomForm): Promise<boolean> {
    if (customForm.featureType !== 'club_registration' || !customForm.featureId) return false

    const club = await Club.find(customForm.featureId)
    return club?.isRegistrationOpen === true
  }

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

      const customForms = await query.orderBy('createdAt', 'desc').paginate(page, perPage)

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

      const customForm = await createCustomFormWithClubInvariant(payload)

      return response.created({
        message: 'CUSTOM_FORM_CREATED_SUCCESS',
        data: customForm,
      })
    } catch (error) {
      if (error instanceof ClubFormAttachmentError) {
        return response.status(error.status).send({ message: error.code })
      }

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
      const payload = await request.validateUsing(updateCustomFormValidator)
      const customForm = await updateCustomFormWithClubInvariant(Number(params.id), payload)

      return response.ok({
        message: 'CUSTOM_FORM_UPDATED_SUCCESS',
        data: customForm,
      })
    } catch (error) {
      if (error instanceof ClubFormAttachmentError) {
        return response.status(error.status).send({ message: error.code })
      }

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

      if (await this.isAttachedToOpenClub(customForm)) {
        return response.badRequest({ message: 'CLOSE_REGISTRATION_BEFORE_FORM_CHANGE' })
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
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
        .first()

      if (!customForm) {
        return response.ok({
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

      if (customForm.isActive && (await this.isAttachedToOpenClub(customForm))) {
        return response.badRequest({ message: 'CLOSE_REGISTRATION_BEFORE_FORM_CHANGE' })
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

  async getUnattachedForms({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search

      const query = CustomForm.query().whereNull('featureId')

      // Apply search filter
      if (search) {
        query.where('formName', 'ILIKE', `%${search}%`)
      }

      const unattachedForms = await query.orderBy('createdAt', 'desc').paginate(page, perPage)

      return response.ok({
        message: 'GET_UNATTACHED_FORMS_SUCCESS',
        data: unattachedForms,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async attachToClub({ params, request, response }: HttpContext) {
    try {
      const formId = Number(params.id)
      const { clubId } = await request.validateUsing(attachCustomFormToClubValidator)
      const customForm = await attachCustomFormToClub(formId, clubId)

      return response.ok({
        message: 'FORM_ATTACHED_TO_CLUB_SUCCESS',
        data: customForm,
      })
    } catch (error) {
      if (error instanceof ClubFormAttachmentError) {
        return response.status(error.status).send({ message: error.code })
      }

      if (error.name === 'ValidationException') {
        return response.badRequest({
          message: 'CLUB_ID_REQUIRED',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async detachFromClub({ params, response }: HttpContext) {
    try {
      const updatedForm = await updateCustomFormWithClubInvariant(Number(params.id), {
        featureId: null,
      })

      return response.ok({
        message: 'FORM_DETACHED_FROM_CLUB_SUCCESS',
        data: updatedForm,
      })
    } catch (error) {
      if (error instanceof ClubFormAttachmentError) {
        return response.status(error.status).send({ message: error.code })
      }

      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async getAvailableActivities({ request, response }: HttpContext) {
    try {
      const currentFormId = request.qs().current_form_id

      // Get activity IDs that have forms attached (excluding current form if provided)
      const formsQuery = CustomForm.query()
        .select('featureId')
        .where('featureType', 'activity_registration')
        .whereNotNull('featureId')

      if (currentFormId) {
        formsQuery.whereNot('id', currentFormId)
      }

      const formsWithActivities = await formsQuery
      const activityIdsWithForms = formsWithActivities.map((form) => form.featureId)

      // Use database-level filtering with whereNotIn instead of in-memory filter
      const activitiesQuery = Activity.query().select('id', 'name').orderBy('name', 'asc')

      if (activityIdsWithForms.length > 0) {
        activitiesQuery.whereNotIn('id', activityIdsWithForms as number[])
      }

      const availableActivities = await activitiesQuery

      return response.ok({
        message: 'GET_AVAILABLE_ACTIVITIES_SUCCESS',
        data: availableActivities,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async getAvailableClubs({ request, response }: HttpContext) {
    try {
      const currentFormId = request.qs().current_form_id

      // Get club IDs that have forms attached (excluding current form if provided)
      const formsQuery = CustomForm.query()
        .select('featureId')
        .where('featureType', 'club_registration')
        .whereNotNull('featureId')

      if (currentFormId) {
        formsQuery.whereNot('id', currentFormId)
      }

      const formsWithClubs = await formsQuery
      const clubIdsWithForms = formsWithClubs.map((form) => form.featureId)

      // Use database-level filtering with whereNotIn instead of in-memory filter
      const clubsQuery = Club.query().select('id', 'name').orderBy('name', 'asc')

      if (clubIdsWithForms.length > 0) {
        clubsQuery.whereNotIn('id', clubIdsWithForms as number[])
      }

      const availableClubs = await clubsQuery

      return response.ok({
        message: 'GET_AVAILABLE_CLUBS_SUCCESS',
        data: availableClubs,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async attachToActivity({ params, request, response }: HttpContext) {
    try {
      const formId: number = params.id
      const { activityId } = request.all()

      if (!activityId) {
        return response.badRequest({
          message: 'ACTIVITY_ID_REQUIRED',
        })
      }

      const customForm = await CustomForm.find(formId)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      // Check if the form is already attached to something
      if (customForm.featureId) {
        return response.badRequest({
          message: 'FORM_ALREADY_ATTACHED',
        })
      }

      // Attach the form to the activity
      customForm.featureType = 'activity_registration'
      customForm.featureId = activityId
      await customForm.save()

      return response.ok({
        message: 'FORM_ATTACHED_TO_ACTIVITY_SUCCESS',
        data: customForm,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async detachFromActivity({ params, response }: HttpContext) {
    try {
      const formId: number = params.id

      const customForm = await CustomForm.find(formId)

      if (!customForm) {
        return response.notFound({
          message: 'CUSTOM_FORM_NOT_FOUND',
        })
      }

      // Detach the form from any feature by setting featureId to null
      await CustomForm.query().where('id', formId).update({
        featureId: null,
        updatedAt: new Date(),
      })

      // Fetch the updated form
      const updatedForm = await CustomForm.find(formId)

      return response.ok({
        message: 'FORM_DETACHED_FROM_ACTIVITY_SUCCESS',
        data: updatedForm,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }
}

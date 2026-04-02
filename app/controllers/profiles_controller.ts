import { HttpContext } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'
import PublicUser from '#models/public_user'
import Profile from '#models/profile'
import { updateProfileValidator } from '#validators/profile_validator'
import { regionalAssignmentValidator } from '#validators/member_validator'

export default class ProfilesController {
  async index({ request, response }: HttpContext) {
    try {
      const page = request.qs().page ?? 1
      const perPage = request.qs().per_page ?? 10
      const search = request.qs().search
      const badge = request.qs().badge
      const memberId = request.qs().member_id
      const educationInstitution = request.qs().education_institution

      let query = Profile.query()
        .select('*')
        .where((query) => {
          if (search) {
            query
              .where('name', 'ILIKE', '%' + search + '%')
              .orWhereHas('publicUser', (subQuery) => {
                subQuery
                  .where('email', 'ILIKE', '%' + search + '%')
                  .orWhere('member_id', 'ILIKE', '%' + search + '%')
              })
          }
          if (memberId) {
            query.whereHas('publicUser', (subQuery) => {
              subQuery.where('member_id', memberId)
            })
          }
          if (educationInstitution) {
            query.whereRaw(
              `EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(education_history, '[]'::jsonb)) AS edu
                WHERE edu->>'institution' ILIKE ?
              )`,
              [`%${educationInstitution}%`]
            )
          }
        })
        .preload('publicUser')
        .orderBy('name', 'asc')

      if (badge) {
        query = query.whereRaw(
          `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(badges) badge
          WHERE badge ILIKE ?
        )`,
          [`%${badge}%`]
        )
      }

      const profiles = await query.paginate(page, perPage)

      return response.ok({
        messages: 'GET_DATA_SUCCESS',
        data: profiles,
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
      const profile = await Profile.query()
        .select('*')
        .where('id', id)
        .preload('province')
        .preload('university')
        .preload('city')
        .preload('publicUser')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: { profile },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async showByUserId({ params, response }: HttpContext) {
    try {
      const id: number = params.id
      const profile = await Profile.query()
        .select('*')
        .where('user_id', id)
        .preload('province')
        .preload('university')
        .preload('city')
        .preload('publicUser')

      return response.ok({
        message: 'GET_DATA_SUCCESS',
        data: { profile },
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const payload = await updateProfileValidator.validate(request.all())
      const id: number = params.id
      const profile = await Profile.findOrFail(id)

      if (payload.password) {
        const user = await PublicUser.find(profile.userId)
        user?.merge({ password: payload.password }).save()
        delete payload.password
      }

      if (payload.extra_data) {
        payload.extra_data = { ...(profile.extraData ?? {}), ...payload.extra_data }
      }

      const updated = await profile.merge(payload).save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: updated,
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.internalServerError({
          message: error.messages[0]?.message || 'VALIDATION_ERROR',
          error: error.messages,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async updateRegionalAssignment({ params, request, response }: HttpContext) {
    try {
      const payload = await regionalAssignmentValidator.validate(request.all())
      const id: number = params.id
      const profile = await Profile.findOrFail(id)

      const currentExtraData = profile.extraData ?? {}
      profile.extraData = {
        ...currentExtraData,
        alumni_regional_assignment: payload.alumni_regional_assignment,
      }
      await profile.save()

      return response.ok({
        message: 'UPDATE_DATA_SUCCESS',
        data: { alumni_regional_assignment: profile.extraData.alumni_regional_assignment },
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'PROFILE_NOT_FOUND' })
      }
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.internalServerError({
          message: error.messages[0]?.message || 'VALIDATION_ERROR',
          error: error.messages,
        })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async delete({ params, response }: HttpContext) {
    const id = params.id
    try {
      const profile = await Profile.findOrFail(id)
      if (!profile) {
        return response.ok({
          message: 'PROFILE_NOT_FOUND',
        })
      }
      await Profile.query().where('id', profile.id).delete()
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

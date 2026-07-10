import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import Club from '#models/club'
import ClubMemberRole from '#models/club_member_role'
import ClubRegistration from '#models/club_registration'
import {
  storeClubMemberRoleValidator,
  updateClubMemberRoleValidator,
} from '#validators/club_member_role_validator'

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'UNKNOWN_ERROR'

export default class ClubMemberRolesController {
  async index({ params, response }: HttpContext) {
    try {
      const club = await Club.findOrFail(params.id)

      const roles = await ClubMemberRole.query()
        .whereHas('registration', (registrationQuery) => {
          registrationQuery.where('club_id', club.id).where('status', 'APPROVED')
        })
        .preload('registration', (registrationQuery) => {
          registrationQuery.preload('member', (memberQuery) => {
            memberQuery.preload('profile')
          })
        })
        .orderBy('sort_order', 'asc')
        .orderBy('is_primary', 'desc')
        .orderBy('created_at', 'asc')

      return response.ok({
        message: 'CLUB_MEMBER_ROLES_RETRIEVED',
        data: roles,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async suggestions({ params, response }: HttpContext) {
    try {
      const club = await Club.findOrFail(params.id)

      const roles = await ClubMemberRole.query()
        .whereHas('registration', (registrationQuery) => {
          registrationQuery.where('club_id', club.id)
        })
        .distinct('role_name')
        .orderBy('role_name', 'asc')

      return response.ok({
        message: 'CLUB_MEMBER_ROLE_SUGGESTIONS_RETRIEVED',
        data: roles.map((role) => role.roleName),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async store({ params, request, response }: HttpContext) {
    try {
      const club = await Club.findOrFail(params.id)
      const payload = await request.validateUsing(storeClubMemberRoleValidator)

      const registration = await ClubRegistration.query()
        .where('id', payload.club_registration_id)
        .where('club_id', club.id)
        .where('status', 'APPROVED')
        .first()

      if (!registration) {
        return response.badRequest({
          message: 'APPROVED_CLUB_MEMBER_REQUIRED',
        })
      }

      if (payload.is_primary) {
        await ClubMemberRole.query()
          .where('club_registration_id', registration.id)
          .update({ is_primary: false })
      }

      const role = await ClubMemberRole.create({
        clubRegistrationId: registration.id,
        roleName: payload.role_name,
        startDate: payload.start_date ? DateTime.fromJSDate(payload.start_date) : null,
        endDate: payload.end_date ? DateTime.fromJSDate(payload.end_date) : null,
        isPrimary: payload.is_primary ?? false,
        sortOrder: payload.sort_order ?? 0,
      })

      await role.load('registration', (registrationQuery) => {
        registrationQuery.preload('member', (memberQuery) => {
          memberQuery.preload('profile')
        })
      })

      return response.created({
        message: 'CLUB_MEMBER_ROLE_CREATED',
        data: role,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateClubMemberRoleValidator)
      const role = await ClubMemberRole.findOrFail(params.id)

      if (payload.is_primary) {
        await ClubMemberRole.query()
          .where('club_registration_id', role.clubRegistrationId)
          .whereNot('id', role.id)
          .update({ is_primary: false })
      }

      const updated = await role
        .merge({
          ...(payload.role_name !== undefined ? { roleName: payload.role_name } : {}),
          ...(payload.start_date !== undefined
            ? {
                startDate: payload.start_date ? DateTime.fromJSDate(payload.start_date) : null,
              }
            : {}),
          ...(payload.end_date !== undefined
            ? { endDate: payload.end_date ? DateTime.fromJSDate(payload.end_date) : null }
            : {}),
          ...(payload.is_primary !== undefined ? { isPrimary: payload.is_primary } : {}),
          ...(payload.sort_order !== undefined ? { sortOrder: payload.sort_order } : {}),
        })
        .save()

      await updated.load('registration', (registrationQuery) => {
        registrationQuery.preload('member', (memberQuery) => {
          memberQuery.preload('profile')
        })
      })

      return response.ok({
        message: 'CLUB_MEMBER_ROLE_UPDATED',
        data: updated,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const role = await ClubMemberRole.findOrFail(params.id)
      await role.delete()

      return response.ok({
        message: 'CLUB_MEMBER_ROLE_DELETED',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: getErrorMessage(error),
      })
    }
  }
}

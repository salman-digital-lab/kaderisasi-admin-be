import { HttpContext } from '@adonisjs/core/http'
import database from '@adonisjs/lucid/services/db'
import { errors } from '@vinejs/vine'
import PublicUser from '#models/public_user'
import Profile from '#models/profile'
import { createMemberValidator, generateAccountValidator } from '#validators/member_validator'

function generateMemberId(id: number): string {
  return String(id).padStart(8, '0')
}

export default class MembersController {
  async store({ request, response }: HttpContext) {
    try {
      const payload = await createMemberValidator.validate(request.all())

      const hasCredentials = !!payload.email && !!payload.password

      if (payload.email) {
        const existing = await PublicUser.findBy('email', payload.email)
        if (existing) {
          return response.conflict({ message: 'EMAIL_ALREADY_REGISTERED' })
        }
      }

      let user: PublicUser
      let profile: Profile

      await database.transaction(async (trx) => {
        user = new PublicUser()
        user.email = payload.email ?? null
        user.password = payload.password ?? null
        user.accountStatus = hasCredentials ? 'active' : 'no_account'
        user.useTransaction(trx)
        await user.save()

        if (payload.member_id) {
          const existingMemberId = await PublicUser.findBy('member_id', payload.member_id)
          if (existingMemberId) {
            throw new Error('MEMBER_ID_ALREADY_EXISTS')
          }
          user.memberId = payload.member_id
        } else {
          user.memberId = generateMemberId(user.id)
        }
        await user.save()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile = await (user as any).related('profile').create({
          name: payload.name,
          gender: payload.gender ?? null,
          personal_id: payload.personal_id ?? null,
          whatsapp: payload.whatsapp ?? null,
          instagram: payload.instagram ?? null,
          tiktok: payload.tiktok ?? null,
          linkedin: payload.linkedin ?? null,
          line: payload.line ?? null,
          birth_date: payload.birth_date ?? null,
          province_id: payload.province_id ?? null,
          city_id: payload.city_id ?? null,
          place_of_birth: payload.place_of_birth ?? null,
          country: payload.country ?? null,
        })
      })

      return response.created({
        message: 'CREATE_MEMBER_SUCCESS',
        data: { user: user!, profile: profile! },
      })
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return response.internalServerError({
          message: error.messages[0]?.message || 'VALIDATION_ERROR',
          error: error.messages,
        })
      }
      if (error.message === 'MEMBER_ID_ALREADY_EXISTS') {
        return response.conflict({ message: 'MEMBER_ID_ALREADY_EXISTS' })
      }
      return response.internalServerError({
        message: 'GENERAL_ERROR',
        error: error.message,
      })
    }
  }

  async generateAccount({ params, request, response }: HttpContext) {
    try {
      const payload = await generateAccountValidator.validate(request.all())
      const userId: number = params.id

      const user = await PublicUser.findOrFail(userId)

      if (user.accountStatus === 'active') {
        return response.badRequest({ message: 'ACCOUNT_ALREADY_ACTIVE' })
      }

      const existing = await PublicUser.query()
        .where('email', payload.email)
        .whereNot('id', userId)
        .first()
      if (existing) {
        return response.conflict({ message: 'EMAIL_ALREADY_REGISTERED' })
      }

      user.email = payload.email
      user.password = payload.password
      user.accountStatus = 'active'
      await user.save()

      return response.ok({
        message: 'GENERATE_ACCOUNT_SUCCESS',
        data: { email: user.email },
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'MEMBER_NOT_FOUND' })
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
}

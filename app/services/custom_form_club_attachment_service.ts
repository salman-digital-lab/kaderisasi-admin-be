import { isDeepStrictEqual } from 'node:util'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Club from '#models/club'
import CustomForm from '#models/custom_form'

type MutableCustomFormFields = Pick<
  CustomForm,
  | 'formName'
  | 'formDescription'
  | 'postSubmissionInfo'
  | 'featureType'
  | 'featureId'
  | 'formSchema'
  | 'isActive'
>

export type CustomFormCreatePayload = Partial<MutableCustomFormFields> &
  Pick<MutableCustomFormFields, 'formName'>

export type CustomFormUpdatePayload = Partial<MutableCustomFormFields>

type ClubAttachmentState = Pick<MutableCustomFormFields, 'featureType' | 'featureId'>

type OpenClubFormState = ClubAttachmentState &
  Pick<MutableCustomFormFields, 'formSchema' | 'isActive'>

export type ClubFormAttachmentErrorCode =
  | 'CUSTOM_FORM_NOT_FOUND'
  | 'CLUB_NOT_FOUND'
  | 'FORM_ALREADY_ATTACHED'
  | 'CLUB_ALREADY_HAS_FORM'
  | 'CLOSE_REGISTRATION_BEFORE_FORM_CHANGE'

const ERROR_STATUS: Record<ClubFormAttachmentErrorCode, 400 | 404 | 409> = {
  CUSTOM_FORM_NOT_FOUND: 404,
  CLUB_NOT_FOUND: 404,
  FORM_ALREADY_ATTACHED: 409,
  CLUB_ALREADY_HAS_FORM: 409,
  CLOSE_REGISTRATION_BEFORE_FORM_CHANGE: 400,
}

export class ClubFormAttachmentError extends Error {
  readonly status: 400 | 404 | 409

  constructor(readonly code: ClubFormAttachmentErrorCode) {
    super(code)
    this.name = 'ClubFormAttachmentError'
    this.status = ERROR_STATUS[code]
  }
}

export function getClubAttachmentId(state: Partial<ClubAttachmentState>): number | null {
  if (state.featureType !== 'club_registration' || state.featureId === null) return null

  return state.featureId ?? null
}

export function getUpdatedClubAttachmentId(
  current: ClubAttachmentState,
  changes: Pick<CustomFormUpdatePayload, 'featureType' | 'featureId'>
): number | null {
  return getClubAttachmentId({
    featureType: changes.featureType ?? current.featureType,
    featureId: changes.featureId === undefined ? current.featureId : changes.featureId,
  })
}

export function changesOpenClubForm(
  current: OpenClubFormState,
  changes: CustomFormUpdatePayload
): boolean {
  return (
    (changes.isActive === false && current.isActive) ||
    (changes.featureId !== undefined && changes.featureId !== current.featureId) ||
    (changes.featureType !== undefined && changes.featureType !== current.featureType) ||
    (changes.formSchema !== undefined && !isDeepStrictEqual(changes.formSchema, current.formSchema))
  )
}

export function hasOtherAttachedClubForm(
  attachedFormIds: readonly number[],
  currentFormId?: number
): boolean {
  return attachedFormIds.some((formId) => formId !== currentFormId)
}

async function lockClubs(
  trx: TransactionClientContract,
  clubIds: Array<number | null>
): Promise<Map<number, Club>> {
  const uniqueClubIds = [
    ...new Set(clubIds.filter((clubId): clubId is number => clubId !== null)),
  ].sort((first, second) => first - second)

  if (uniqueClubIds.length === 0) return new Map()

  const clubs = await Club.query({ client: trx })
    .whereIn('id', uniqueClubIds)
    .orderBy('id', 'asc')
    .forUpdate()

  return new Map(clubs.map((club) => [club.id, club]))
}

async function ensureClubHasNoOtherForm(
  trx: TransactionClientContract,
  clubId: number,
  currentFormId?: number
): Promise<void> {
  const attachedForms = await CustomForm.query({ client: trx })
    .select('id')
    .where('featureType', 'club_registration')
    .where('featureId', clubId)

  if (
    hasOtherAttachedClubForm(
      attachedForms.map((form) => form.id),
      currentFormId
    )
  ) {
    throw new ClubFormAttachmentError('CLUB_ALREADY_HAS_FORM')
  }
}

export async function createCustomFormWithClubInvariant(
  payload: CustomFormCreatePayload
): Promise<CustomForm> {
  const clubId = getClubAttachmentId(payload)

  if (clubId === null) {
    return CustomForm.create(payload)
  }

  return db.transaction(async (trx) => {
    const clubs = await lockClubs(trx, [clubId])
    if (!clubs.has(clubId)) {
      throw new ClubFormAttachmentError('CLUB_NOT_FOUND')
    }

    await ensureClubHasNoOtherForm(trx, clubId)
    return CustomForm.create(payload, { client: trx })
  })
}

export async function updateCustomFormWithClubInvariant(
  formId: number,
  payload: CustomFormUpdatePayload
): Promise<CustomForm> {
  if (!Number.isSafeInteger(formId) || formId <= 0) {
    throw new ClubFormAttachmentError('CUSTOM_FORM_NOT_FOUND')
  }

  return db.transaction(async (trx) => {
    const customForm = await CustomForm.query({ client: trx })
      .where('id', formId)
      .forUpdate()
      .first()

    if (!customForm) {
      throw new ClubFormAttachmentError('CUSTOM_FORM_NOT_FOUND')
    }

    const currentClubId = getClubAttachmentId(customForm)
    const targetClubId = getUpdatedClubAttachmentId(customForm, payload)
    const changesProtectedForm = changesOpenClubForm(customForm, payload)
    const clubs = await lockClubs(trx, [targetClubId, changesProtectedForm ? currentClubId : null])

    if (changesProtectedForm && currentClubId !== null) {
      const currentClub = clubs.get(currentClubId)
      if (currentClub?.isRegistrationOpen) {
        throw new ClubFormAttachmentError('CLOSE_REGISTRATION_BEFORE_FORM_CHANGE')
      }
    }

    if (targetClubId !== null) {
      if (!clubs.has(targetClubId)) {
        throw new ClubFormAttachmentError('CLUB_NOT_FOUND')
      }

      await ensureClubHasNoOtherForm(trx, targetClubId, customForm.id)
    }

    customForm.useTransaction(trx)
    await customForm.merge(payload).save()
    return customForm
  })
}

export async function attachCustomFormToClub(formId: number, clubId: number): Promise<CustomForm> {
  if (!Number.isSafeInteger(formId) || formId <= 0) {
    throw new ClubFormAttachmentError('CUSTOM_FORM_NOT_FOUND')
  }

  return db.transaction(async (trx) => {
    const customForm = await CustomForm.query({ client: trx })
      .where('id', formId)
      .forUpdate()
      .first()

    if (!customForm) {
      throw new ClubFormAttachmentError('CUSTOM_FORM_NOT_FOUND')
    }

    if (customForm.featureId !== null) {
      throw new ClubFormAttachmentError('FORM_ALREADY_ATTACHED')
    }

    const clubs = await lockClubs(trx, [clubId])
    if (!clubs.has(clubId)) {
      throw new ClubFormAttachmentError('CLUB_NOT_FOUND')
    }

    await ensureClubHasNoOtherForm(trx, clubId)

    customForm.useTransaction(trx)
    customForm.featureType = 'club_registration'
    customForm.featureId = clubId
    await customForm.save()
    return customForm
  })
}

import { test } from '@japa/runner'
import {
  changesOpenClubForm,
  ClubFormAttachmentError,
  getClubAttachmentId,
  getUpdatedClubAttachmentId,
  hasOtherAttachedClubForm,
} from '#services/custom_form_club_attachment_service'

const formSchema = {
  fields: [
    {
      section_name: 'profile',
      fields: [{ key: 'name', label: 'Name', required: true, type: 'text' }],
    },
  ],
}

test.group('Club custom-form attachment invariants', () => {
  test('only treats a Club form with a feature ID as attached', ({ assert }) => {
    assert.equal(getClubAttachmentId({ featureType: 'club_registration', featureId: 12 }), 12)
    assert.isNull(getClubAttachmentId({ featureType: 'club_registration', featureId: null }))
    assert.isNull(getClubAttachmentId({ featureType: 'activity_registration', featureId: 12 }))
  })

  test('derives the final Club target from partial updates', ({ assert }) => {
    const current = { featureType: 'club_registration' as const, featureId: 12 }

    assert.equal(getUpdatedClubAttachmentId(current, {}), 12)
    assert.equal(getUpdatedClubAttachmentId(current, { featureId: 24 }), 24)
    assert.isNull(
      getUpdatedClubAttachmentId(current, {
        featureType: 'independent_form',
        featureId: null,
      })
    )
  })

  test('protects structural form-schema changes while registration is open', ({ assert }) => {
    const current = {
      featureType: 'club_registration' as const,
      featureId: 12,
      formSchema,
      isActive: true,
    }

    assert.isFalse(changesOpenClubForm(current, { formSchema: structuredClone(formSchema) }))
    assert.isTrue(
      changesOpenClubForm(current, {
        formSchema: { fields: [{ section_name: 'profile', fields: [] }] },
      })
    )
    assert.isTrue(changesOpenClubForm(current, { isActive: false }))
  })

  test('rejects any other form already attached to the target Club', ({ assert }) => {
    assert.isTrue(hasOtherAttachedClubForm([41]))
    assert.isFalse(hasOtherAttachedClubForm([41], 41))
    assert.isTrue(hasOtherAttachedClubForm([41, 42], 41))
  })

  test('exposes explicit HTTP statuses for missing and conflicting attachments', ({ assert }) => {
    for (const code of ['CUSTOM_FORM_NOT_FOUND', 'CLUB_NOT_FOUND'] as const) {
      assert.equal(new ClubFormAttachmentError(code).status, 404)
    }

    for (const code of ['FORM_ALREADY_ATTACHED', 'CLUB_ALREADY_HAS_FORM'] as const) {
      assert.equal(new ClubFormAttachmentError(code).status, 409)
    }
  })
})

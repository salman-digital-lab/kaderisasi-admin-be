import { test } from '@japa/runner'
import { clubValidator, updateClubValidator } from '#validators/club_validator'

test.group('Club validator', () => {
  test('accepts a minimal draft without optional Club details', async ({ assert }) => {
    const payload = await clubValidator.validate({
      name: 'Klub Minimal',
      club_type: 'UNIT',
    })

    assert.deepEqual(payload, {
      name: 'Klub Minimal',
      club_type: 'UNIT',
    })
  })

  test('accepts exactly the four supported Club types', async ({ assert }) => {
    const supportedTypes = ['UNIT', 'CLUB_KEPROFESIAN', 'CLUB_BAHASA', 'AVISMAN_REGIONAL'] as const

    for (const clubType of supportedTypes) {
      const payload = await clubValidator.validate({ name: 'Klub', club_type: clubType })
      assert.equal(payload.club_type, clubType)
    }

    await assert.rejects(() => clubValidator.validate({ name: 'Klub', club_type: 'UKM' }))
  })

  test('preserves explicit null values used to clear Club dates', async ({ assert }) => {
    const payload = await updateClubValidator.validate({
      start_period: null,
      end_period: null,
      registration_end_date: null,
    })

    assert.deepEqual(payload, {
      start_period: null,
      end_period: null,
      registration_end_date: null,
    })
  })
})

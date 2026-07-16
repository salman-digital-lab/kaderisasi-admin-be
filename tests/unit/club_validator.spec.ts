import { test } from '@japa/runner'
import { updateClubValidator } from '#validators/club_validator'

test.group('Club validator', () => {
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

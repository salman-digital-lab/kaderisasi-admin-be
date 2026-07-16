import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { getExpiredClubPeriodCutoff } from '#services/club_schedule_service'

test.group('Club scheduling', () => {
  test('keeps a Club visible through its complete end month', ({ assert }) => {
    const now = DateTime.fromISO('2026-07-16', { zone: 'Asia/Jakarta' })

    assert.equal(getExpiredClubPeriodCutoff(now), '2026-07-01')
  })
})

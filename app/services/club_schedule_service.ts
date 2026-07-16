import { DateTime } from 'luxon'

/** A Club end period represents its whole calendar month. */
export function getExpiredClubPeriodCutoff(now: DateTime = DateTime.local()): string {
  const cutoff = now.startOf('month').toISODate()
  if (!cutoff) throw new Error('INVALID_CLUB_VISIBILITY_DATE')
  return cutoff
}

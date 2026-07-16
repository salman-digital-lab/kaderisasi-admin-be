import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Club from '#models/club'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { getExpiredClubPeriodCutoff } from '#services/club_schedule_service'

export default class UpdateClubVisibility extends BaseCommand {
  static commandName = 'clubs:update-visibility'
  static description = 'Set club is_show to false when the period has ended'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    try {
      const currentDate = DateTime.local()
      const expiredPeriodCutoff = getExpiredClubPeriodCutoff(currentDate)

      // Find clubs that are currently shown but their period has ended
      // An end period represents a whole month, so the Club remains visible throughout that month.
      const expiredClubs = await Club.query()
        .where('is_show', true)
        .whereNotNull('end_period')
        .where('end_period', '<', expiredPeriodCutoff)
        .update({ is_show: false }, ['id', 'name', 'end_period'])

      logger.info('Completed: Updated club visibility')
      logger.info(`Updated ${expiredClubs.length} club(s)`)

      for (let club of expiredClubs) {
        logger.info(`Club ID ${club.id} (${club.name}) - Period ended: ${club.end_period}`)
      }

      if (expiredClubs.length === 0) {
        logger.info('No clubs found with expired periods')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      logger.error(`Error updating club visibility: ${message}`)
      throw error
    }
  }
}

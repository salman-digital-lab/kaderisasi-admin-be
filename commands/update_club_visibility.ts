import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Club from '#models/club'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class UpdateClubVisibility extends BaseCommand {
  static commandName = 'clubs:update-visibility'
  static description = 'Set club is_show to false when the period has ended'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    try {
      const currentDate = DateTime.local()
      const endOfCurrentMonth = currentDate.endOf('month')

      // Find clubs that are currently shown but their period has ended
      // The period is considered ended if the current date is past the end of the month specified in end_period
      const expiredClubs = await Club.query()
        .where('is_show', true)
        .whereNotNull('end_period')
        .where('end_period', '<', endOfCurrentMonth.toSQLDate())
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
      logger.error(`Error updating club visibility: ${error.message}`)
    }
  }
}

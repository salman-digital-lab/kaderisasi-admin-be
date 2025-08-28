import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Club from '#models/club'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class CloseClubRegistration extends BaseCommand {
  static commandName = 'clubs:close-registration'
  static description = 'Set club is_registration_open to false when registration_end_date has passed'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    try {
      const currentDate = DateTime.local()

      // Find clubs that have registration open but their registration end date has passed
      const expiredClubs = await Club.query()
        .where('is_registration_open', true)
        .whereNotNull('registration_end_date')
        .where('registration_end_date', '<', currentDate.toSQLDate())
        .update({ is_registration_open: false }, ['id', 'name', 'registration_end_date'])

      logger.info('Completed: Closed club registrations')
      logger.info(`Updated ${expiredClubs.length} club(s)`)
      
      for (let club of expiredClubs) {
        logger.info(`Club ID ${club.id} (${club.name}) - Registration ended: ${club.registration_end_date}`)
      }

      if (expiredClubs.length === 0) {
        logger.info('No clubs found with expired registration periods')
      }
    } catch (error) {
      logger.error(`Error closing club registrations: ${error.message}`)
    }
  }
}

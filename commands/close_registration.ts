import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Activity from '#models/activity'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class CloseRegistration extends BaseCommand {
  static commandName = 'close:registration'
  static description = 'Set activity is_published as 0'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    try {
      var activities = await Activity.query()
        .where({ is_published: 1 })
        .where('registration_end', '<', DateTime.local().toSQLDate())
        .update({ is_published: 0 }, ['id', 'slug'])

      logger.info('completed: unpublished activities')
      for (let data of activities) {
        logger.info('ID ' + data.id)
      }
    } catch (error) {
      logger.error(error.message)
    }
  }
}

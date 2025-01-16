import scheduler from 'adonisjs-scheduler/services/main'
import CloseRegistration from '../commands/close_registration.js'

scheduler.command(CloseRegistration).daily()

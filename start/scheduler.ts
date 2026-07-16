import scheduler from 'adonisjs-scheduler/services/main'
import CloseRegistration from '../commands/close_registration.js'
import CloseClubRegistration from '../commands/close_club_registration.js'
import UpdateClubVisibility from '../commands/update_club_visibility.js'

scheduler.command(CloseRegistration).daily()
scheduler.command(CloseClubRegistration).daily()
scheduler.command(UpdateClubVisibility).daily()

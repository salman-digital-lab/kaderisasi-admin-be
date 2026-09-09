import { BasePolicy } from '@adonisjs/bouncer'
import type AdminUser from '#models/admin_user'
import type Ticket from '#models/ticket'

export default class TicketPolicy extends BasePolicy {
  view(user: AdminUser, ticket: Ticket): boolean {
    return user.id === ticket.requesterAdminUserId
  }

  cancel(user: AdminUser, ticket: Ticket): boolean {
    return this.view(user, ticket) && ticket.status === 'open'
  }
}

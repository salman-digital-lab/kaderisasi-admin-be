import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type TicketStatus = 'open' | 'resolved' | 'cancelled'
export type TicketResolution = 'approved' | 'rejected' | null

export default class Ticket extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare number: string
  @column() declare status: TicketStatus
  @column() declare resolution: TicketResolution
  @column() declare requesterAdminUserId: number
  @column() declare requestedRoleCode: string
  @column() declare resolvedByAdminUserId: number | null
  @column() declare reason: string
  @column() declare rejectionReason: string | null
  @column.dateTime() declare resolvedAt: DateTime | null
  @column.dateTime() declare cancelledAt: DateTime | null
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime | null
}

import { randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { getAdminRole, getRolePermissions } from '#constants/admin_roles'
import { changeAdminAccess } from '#services/access_grant_service'
import Ticket from '#models/ticket'
import TicketPolicy from '#policies/ticket_policy'
import { createAccessRequestValidator, rejectTicketValidator } from '#validators/ticket_validator'

function makeTicketNumber(): string {
  return `AR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
}

function withRoleName<T extends { requested_role_code: string }>(
  ticket: T
): T & { role_name: string } {
  return {
    ...ticket,
    role_name: getAdminRole(ticket.requested_role_code)?.name ?? ticket.requested_role_code,
  }
}

async function ticketDetails(ticketId: number) {
  const ticket = await db
    .from('tickets as t')
    .join('admin_users as requester', 'requester.id', 't.requester_admin_user_id')
    .leftJoin('admin_users as reviewer', 'reviewer.id', 't.resolved_by_admin_user_id')
    .where('t.id', ticketId)
    .select(
      't.*',
      'requester.display_name as requester_name',
      'requester.email as requester_email',
      'reviewer.display_name as reviewer_name'
    )
    .first()
  return ticket ? withRoleName(ticket) : null
}

export default class AccessRequestsController {
  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(createAccessRequestValidator)
    const requester = ctx.auth.getUserOrFail()
    const role = getAdminRole(payload.role_code)
    if (!role?.isRequestable)
      return ctx.response.unprocessableEntity({ message: 'ROLE_NOT_REQUESTABLE' })
    const ticketId = await db.transaction(async (trx) => {
      await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [7412, requester.id])
      const duplicate = await trx
        .from('tickets')
        .where('requester_admin_user_id', requester.id)
        .where('requested_role_code', payload.role_code)
        .where('status', 'open')
        .first()
      if (duplicate) return null
      const [ticket] = await trx
        .table('tickets')
        .insert({
          number: makeTicketNumber(),
          status: 'open',
          requester_admin_user_id: requester.id,
          requested_role_code: payload.role_code,
          reason: payload.reason,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id')
      return Number(ticket.id)
    })
    if (!ticketId) return ctx.response.conflict({ message: 'DUPLICATE_OPEN_REQUEST' })
    return ctx.response.created({
      message: 'ACCESS_REQUEST_CREATED',
      data: await ticketDetails(ticketId),
    })
  }

  async ownIndex(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const tickets = await db
      .from('tickets as t')
      .where('t.requester_admin_user_id', user.id)
      .orderBy('t.created_at', 'desc')
      .select('t.*')
    return ctx.response.ok({ message: 'GET_DATA_SUCCESS', data: tickets.map(withRoleName) })
  }

  async ownShow(ctx: HttpContext) {
    const ticket = await Ticket.find(ctx.params.id)
    if (!ticket) return ctx.response.notFound({ message: 'TICKET_NOT_FOUND' })
    await ctx.bouncer.with(TicketPolicy).authorize('view', ticket)
    return ctx.response.ok({ message: 'GET_DATA_SUCCESS', data: await ticketDetails(ticket.id) })
  }

  async cancel(ctx: HttpContext) {
    const ticket = await Ticket.find(ctx.params.id)
    if (!ticket) return ctx.response.notFound({ message: 'TICKET_NOT_FOUND' })
    await ctx.bouncer.with(TicketPolicy).authorize('cancel', ticket)
    const cancelled = await db.transaction(async (trx) => {
      const locked = await trx.from('tickets').where('id', ticket.id).forUpdate().first()
      if (!locked || locked.status !== 'open') return false
      await trx
        .from('tickets')
        .where('id', ticket.id)
        .update({ status: 'cancelled', cancelled_at: new Date(), updated_at: new Date() })
      return true
    })
    if (!cancelled) return ctx.response.conflict({ message: 'TICKET_ALREADY_TERMINAL' })
    return ctx.response.ok({ message: 'TICKET_CANCELLED', data: await ticketDetails(ticket.id) })
  }

  async reviewIndex(ctx: HttpContext) {
    const status = ctx.request.input('status') as string | undefined
    const query = db
      .from('tickets as t')
      .join('admin_users as requester', 'requester.id', 't.requester_admin_user_id')
      .orderBy('t.created_at', 'desc')
      .select(
        't.*',
        'requester.display_name as requester_name',
        'requester.email as requester_email',
        'requester.id as requester_id'
      )
    if (status) query.where('t.status', status)
    const tickets = await query
    return ctx.response.ok({ message: 'GET_DATA_SUCCESS', data: tickets.map(withRoleName) })
  }

  async reviewShow(ctx: HttpContext) {
    const ticket = await ticketDetails(Number(ctx.params.id))
    if (!ticket) return ctx.response.notFound({ message: 'TICKET_NOT_FOUND' })
    return ctx.response.ok({ message: 'GET_DATA_SUCCESS', data: ticket })
  }

  async approve(ctx: HttpContext) {
    return this.resolve(ctx, 'approved')
  }

  async reject(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(rejectTicketValidator)
    return this.resolve(ctx, 'rejected', payload.rejection_reason)
  }

  private async resolve(
    ctx: HttpContext,
    resolution: 'approved' | 'rejected',
    rejectionReason?: string
  ) {
    const reviewer = ctx.auth.getUserOrFail()
    const result = await db.transaction(async (trx) => {
      await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [7411, 1])
      const actor = await trx.from('admin_users').where('id', reviewer.id).first()
      if (!actor?.is_active || !getRolePermissions(actor.role_code).includes('tickets.review'))
        return 'FORBIDDEN'
      const ticket = await trx.from('tickets').where('id', ctx.params.id).forUpdate().first()
      if (!ticket) return 'TICKET_NOT_FOUND'
      if (ticket.requester_admin_user_id === reviewer.id) return 'SELF_REVIEW_NOT_ALLOWED'
      if (ticket.status !== 'open') return 'TICKET_ALREADY_TERMINAL'
      if (resolution === 'approved') {
        const role = getAdminRole(ticket.requested_role_code)
        if (!role?.isRequestable) return 'ROLE_NOT_REQUESTABLE'
        const error = await changeAdminAccess(trx, ticket.requester_admin_user_id, {
          roleCode: role.code,
        })
        if (error) return error
      }
      await trx
        .from('tickets')
        .where('id', ticket.id)
        .update({
          status: 'resolved',
          resolution,
          rejection_reason: rejectionReason ?? null,
          resolved_by_admin_user_id: reviewer.id,
          resolved_at: new Date(),
          updated_at: new Date(),
        })
      return Number(ticket.id)
    })
    if (result === 'FORBIDDEN') return ctx.response.forbidden({ message: result })
    if (typeof result === 'string')
      return result === 'TICKET_NOT_FOUND'
        ? ctx.response.notFound({ message: result })
        : ctx.response.conflict({ message: result })
    return ctx.response.ok({
      message: resolution === 'approved' ? 'TICKET_APPROVED' : 'TICKET_REJECTED',
      data: await ticketDetails(result),
    })
  }
}

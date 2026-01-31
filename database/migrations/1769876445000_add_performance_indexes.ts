import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Activity Registrations indexes
    this.schema.alterTable('activity_registrations', (table) => {
      // Composite index for user+activity lookups (most common query pattern)
      table.index(['user_id', 'activity_id'], 'idx_act_reg_user_activity')
      // Index for filtering by activity and status
      table.index(['activity_id', 'status'], 'idx_act_reg_activity_status')
    })

    // Profiles indexes
    this.schema.alterTable('profiles', (table) => {
      // Index on user_id for fast lookups (most common)
      table.index(['user_id'], 'idx_profiles_user_id')
      // Index for name search queries
      table.index(['name'], 'idx_profiles_name')
      // Indexes for filtering
      table.index(['university_id'], 'idx_profiles_university')
      table.index(['province_id'], 'idx_profiles_province')
    })

    // Achievements indexes
    this.schema.alterTable('achievements', (table) => {
      // Index for user achievements lookup
      table.index(['user_id'], 'idx_achievements_user_id')
      // Index for filtering by status (pending/approved)
      table.index(['status'], 'idx_achievements_status')
      // Index for filtering by type
      table.index(['type'], 'idx_achievements_type')
      // Composite for user + status queries
      table.index(['user_id', 'status'], 'idx_achievements_user_status')
    })

    // Monthly Leaderboards indexes
    this.schema.alterTable('monthly_leaderboards', (table) => {
      // Composite for user+month lookups
      table.index(['user_id', 'month'], 'idx_monthly_lb_user_month')
      // Index for ranking queries by month
      table.index(['month', 'score'], 'idx_monthly_lb_month_score')
    })

    // Lifetime Leaderboards indexes
    this.schema.alterTable('lifetime_leaderboards', (table) => {
      // Index for user lookup
      table.index(['user_id'], 'idx_lifetime_lb_user_id')
      // Index for ranking queries
      table.index(['score'], 'idx_lifetime_lb_score')
    })

    // Custom Forms indexes
    this.schema.alterTable('custom_forms', (table) => {
      // Composite for feature lookups (most common pattern)
      table.index(['feature_type', 'feature_id'], 'idx_custom_forms_feature')
      // Index for filtering by active status
      table.index(['is_active'], 'idx_custom_forms_active')
    })

    // Club Registrations indexes (already has unique on club_id, member_id)
    this.schema.alterTable('club_registrations', (table) => {
      // Index for filtering by status
      table.index(['status'], 'idx_club_reg_status')
      // Index for member lookup
      table.index(['member_id'], 'idx_club_reg_member')
    })
  }

  async down() {
    // Drop Activity Registrations indexes
    this.schema.alterTable('activity_registrations', (table) => {
      table.dropIndex(['user_id', 'activity_id'], 'idx_act_reg_user_activity')
      table.dropIndex(['activity_id', 'status'], 'idx_act_reg_activity_status')
    })

    // Drop Profiles indexes
    this.schema.alterTable('profiles', (table) => {
      table.dropIndex(['user_id'], 'idx_profiles_user_id')
      table.dropIndex(['name'], 'idx_profiles_name')
      table.dropIndex(['university_id'], 'idx_profiles_university')
      table.dropIndex(['province_id'], 'idx_profiles_province')
    })

    // Drop Achievements indexes
    this.schema.alterTable('achievements', (table) => {
      table.dropIndex(['user_id'], 'idx_achievements_user_id')
      table.dropIndex(['status'], 'idx_achievements_status')
      table.dropIndex(['type'], 'idx_achievements_type')
      table.dropIndex(['user_id', 'status'], 'idx_achievements_user_status')
    })

    // Drop Monthly Leaderboards indexes
    this.schema.alterTable('monthly_leaderboards', (table) => {
      table.dropIndex(['user_id', 'month'], 'idx_monthly_lb_user_month')
      table.dropIndex(['month', 'score'], 'idx_monthly_lb_month_score')
    })

    // Drop Lifetime Leaderboards indexes
    this.schema.alterTable('lifetime_leaderboards', (table) => {
      table.dropIndex(['user_id'], 'idx_lifetime_lb_user_id')
      table.dropIndex(['score'], 'idx_lifetime_lb_score')
    })

    // Drop Custom Forms indexes
    this.schema.alterTable('custom_forms', (table) => {
      table.dropIndex(['feature_type', 'feature_id'], 'idx_custom_forms_feature')
      table.dropIndex(['is_active'], 'idx_custom_forms_active')
    })

    // Drop Club Registrations indexes
    this.schema.alterTable('club_registrations', (table) => {
      table.dropIndex(['status'], 'idx_club_reg_status')
      table.dropIndex(['member_id'], 'idx_club_reg_member')
    })
  }
}

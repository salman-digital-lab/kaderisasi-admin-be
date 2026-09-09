import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const AdminusersController = () => import('#controllers/adminusers_controller')
const RbacRolesController = () => import('#controllers/rbac_roles_controller')
const RbacPermissionsController = () => import('#controllers/rbac_permissions_controller')
const AccessRequestsController = () => import('#controllers/access_requests_controller')
const ProfilesController = () => import('#controllers/profiles_controller')
const ActivitiesController = () => import('#controllers/activities_controller')
const ActivityRegistrationsController = () =>
  import('#controllers/activity_registrations_controller')
const AuthController = () => import('#controllers/auth_controller')
const UniversitiesController = () => import('#controllers/universities_controller')
const RuangCurhatController = () => import('#controllers/ruang_curhats_controller')
const ProvincesController = () => import('#controllers/provinces_controller')
const CitiesController = () => import('#controllers/cities_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const LeaderboardsController = () => import('#controllers/leaderboards_controller')
const ClubsController = () => import('#controllers/clubs_controller')
const ClubRegistrationsController = () => import('#controllers/club_registrations_controller')
const ClubMemberRolesController = () => import('#controllers/club_member_roles_controller')
const CustomFormsController = () => import('#controllers/custom_forms_controller')
const CertificateTemplatesController = () => import('#controllers/certificate_templates_controller')
const CertificatesController = () => import('#controllers/certificates_controller')
const MembersController = () => import('#controllers/members_controller')
const CountriesController = () => import('#controllers/countries_controller')

router
  .group(() => {
    router
      .group(() => {
        router.post('login', [AuthController, 'login'])
        router.post('google', [AuthController, 'google'])
        router.post('refresh', [AuthController, 'refresh'])
        router.post('session/migrate', [AuthController, 'migrate']).use(middleware.auth())
        router.get('me', [AuthController, 'me']).use(middleware.auth())
        router.post('logout', [AuthController, 'logout'])
        router.put('logout', [AuthController, 'logout'])
      })
      .prefix('auth')
      .use(middleware.trustedOrigin())

    router
      .group(() => {
        router
          .get('', [AdminusersController, 'index'])
          .use(middleware.permission({ permission: 'admin_users.read' }))
        router
          .get(':id', [AdminusersController, 'show'])
          .use(middleware.permission({ permission: 'admin_users.read' }))
        router
          .post('', [AdminusersController, 'create'])
          .use(middleware.permission({ permission: 'admin_users.manage' }))
        router
          .put(':id', [AdminusersController, 'update'])
          .use(middleware.permission({ permission: 'admin_users.manage' }))
        router
          .put(':id/password', [AdminusersController, 'editPassword'])
          .use(middleware.permission({ permission: 'admin_users.manage' }))
      })
      .prefix('admin-users')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('permissions', [RbacPermissionsController, 'index'])
          .use(middleware.permission({ permission: 'rbac.read' }))
        router.get('requestable-targets', [RbacPermissionsController, 'requestableTargets'])
        router
          .get('roles', [RbacRolesController, 'index'])
          .use(middleware.permission({ permission: 'rbac.read' }))
        router
          .get('roles/:code', [RbacRolesController, 'show'])
          .use(middleware.permission({ permission: 'rbac.read' }))
      })
      .prefix('rbac')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('', [AccessRequestsController, 'ownIndex'])
        router.post('', [AccessRequestsController, 'store'])
        router.get(':id', [AccessRequestsController, 'ownShow'])
        router.post(':id/cancel', [AccessRequestsController, 'cancel'])
      })
      .prefix('access-requests')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('', [AccessRequestsController, 'reviewIndex'])
        router.get(':id', [AccessRequestsController, 'reviewShow'])
        router.post(':id/approve', [AccessRequestsController, 'approve'])
        router.post(':id/reject', [AccessRequestsController, 'reject'])
      })
      .prefix('tickets/review')
      .use(middleware.auth())
      .use(middleware.permission({ permission: 'tickets.review' }))

    router
      .group(() => {
        router.get('stats', [DashboardController, 'stats'])
        router.get('profiles', [DashboardController, 'CountProfiles'])
        router.get('gender', [DashboardController, 'CountUsersGender'])
      })
      .prefix('dashboard')
      .use(middleware.auth())
      .use(middleware.permission({ permission: 'dashboard.read' }))

    router
      .group(() => {
        router.get('', [UniversitiesController, 'index'])
        router.get('/:id', [UniversitiesController, 'show'])
        router
          .post('', [UniversitiesController, 'store'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .put('/:id', [UniversitiesController, 'update'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .delete(':id', [UniversitiesController, 'delete'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
      })
      .prefix('universities')

    router
      .group(() => {
        router
          .get('user/:id', [ProfilesController, 'showByUserId'])
          .use(middleware.permission({ permission: 'members.read' }))
        router
          .get('/:id', [ProfilesController, 'show'])
          .use(middleware.permission({ permission: 'members.read' }))
        router
          .get('', [ProfilesController, 'index'])
          .use(middleware.permission({ permission: 'members.read' }))
        router
          .put('/:id', [ProfilesController, 'update'])
          .use(middleware.permission({ permission: 'members.manage' }))
        router
          .put('/:id/regional-assignment', [ProfilesController, 'updateRegionalAssignment'])
          .use(middleware.permission({ permission: 'members.manage' }))
        router
          .put('auth/:id', [AuthController, 'updateMember'])
          .use(middleware.permission({ permission: 'members.credentials.manage' }))
        router
          .delete(':id', [ProfilesController, 'delete'])
          .use(middleware.permission({ permission: 'members.manage' }))
      })
      .prefix('profiles')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .post('', [MembersController, 'store'])
          .use(middleware.permission({ permission: 'members.manage' }))
        router
          .post(':id/generate-account', [MembersController, 'generateAccount'])
          .use(middleware.permission({ permission: 'members.credentials.manage' }))
      })
      .prefix('members')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('', [ActivitiesController, 'index'])
          .use(middleware.permission({ permission: 'activities.read' }))
        router
          .get('/:id', [ActivitiesController, 'show'])
          .use(middleware.permission({ permission: 'activities.read' }))
        router
          .post('', [ActivitiesController, 'store'])
          .use(middleware.permission({ permission: 'activities.manage' }))
        router
          .put('/:id', [ActivitiesController, 'update'])
          .use(middleware.permission({ permission: 'activities.manage' }))
        router
          .post(':id/images', [ActivitiesController, 'uploadImage'])
          .use(middleware.permission({ permission: 'activities.manage' }))
        router
          .put(':id/delete-image', [ActivitiesController, 'deleteImage'])
          .use(middleware.permission({ permission: 'activities.manage' }))
        router
          .put(':id/reorder-images', [ActivitiesController, 'reorderImages'])
          .use(middleware.permission({ permission: 'activities.manage' }))
        router
          .get(':id/registrations', [ActivityRegistrationsController, 'index'])
          .use(middleware.permission({ permission: 'activity_registrations.read' }))
        router
          .get(':id/registrations/statistics', [ActivityRegistrationsController, 'statistics'])
          .use(middleware.permission({ permission: 'activity_registrations.read' }))
        router
          .get(':id/registrations-export/', [ActivityRegistrationsController, 'export'])
          .use(middleware.permission({ permission: 'activity_registrations.export' }))
        router
          .put(':id/registrations/status-by-email', [
            ActivityRegistrationsController,
            'updateStatusByListOfEmail',
          ])
          .use(middleware.permission({ permission: 'activity_registrations.manage' }))
        router
          .put(':id/registrations', [ActivityRegistrationsController, 'updateStatusBulk'])
          .use(middleware.permission({ permission: 'activity_registrations.manage' }))
        router
          .post(':id/registrations', [ActivityRegistrationsController, 'store'])
          .use(middleware.permission({ permission: 'activity_registrations.manage' }))
      })
      .prefix('activities')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('/user/:id', [ActivityRegistrationsController, 'getActivityByUserId'])
          .use(middleware.permission({ permission: 'activity_registrations.read' }))
        router
          .get('/:id', [ActivityRegistrationsController, 'show'])
          .use(middleware.permission({ permission: 'activity_registrations.read' }))
        router
          .put('', [ActivityRegistrationsController, 'updateStatus'])
          .use(middleware.permission({ permission: 'activity_registrations.manage' }))
        router
          .delete(':id', [ActivityRegistrationsController, 'delete'])
          .use(middleware.permission({ permission: 'activity_registrations.manage' }))
      })
      .prefix('activity-registrations')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('', [RuangCurhatController, 'index'])
          .use(middleware.permission({ permission: 'counseling.read' }))
        router
          .get('/:id', [RuangCurhatController, 'show'])
          .use(middleware.permission({ permission: 'counseling.read' }))
        router
          .put('/:id', [RuangCurhatController, 'update'])
          .use(middleware.permission({ permission: 'counseling.manage' }))
      })
      .prefix('ruang-curhat')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('', [ProvincesController, 'index'])
        router.get(':id/cities', [CitiesController, 'getByProvinceId'])
        router.get(':id', [ProvincesController, 'show'])
        router
          .post('', [ProvincesController, 'store'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .put(':id', [ProvincesController, 'update'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .delete(':id', [ProvincesController, 'delete'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
      })
      .prefix('provinces')

    router
      .group(() => {
        router.get('', [CitiesController, 'index'])
        router.get(':id', [CitiesController, 'show'])
        router
          .post('', [CitiesController, 'store'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .put(':id', [CitiesController, 'update'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
        router
          .delete(':id', [CitiesController, 'delete'])
          .use(middleware.auth())
          .use(middleware.permission({ permission: 'reference_data.manage' }))
      })
      .prefix('cities')

    router.get('countries', [CountriesController, 'index'])

    router
      .group(() => {
        router
          .get('export', [LeaderboardsController, 'export'])
          .use(middleware.permission({ permission: 'achievements.export' }))
        router
          .get('', [LeaderboardsController, 'index'])
          .use(middleware.permission({ permission: 'achievements.read' }))
        router
          .get(':id', [LeaderboardsController, 'show'])
          .use(middleware.permission({ permission: 'achievements.read' }))
        router
          .put(':id', [LeaderboardsController, 'update'])
          .use(middleware.permission({ permission: 'achievements.review' }))
        router
          .put(':id/approve-reject', [LeaderboardsController, 'approveReject'])
          .use(middleware.permission({ permission: 'achievements.review' }))
      })
      .prefix('achievements')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('monthly', [LeaderboardsController, 'monthlyLeaderboard'])
        router.get('lifetime', [LeaderboardsController, 'lifetimeLeaderboard'])
      })
      .prefix('leaderboards')
      .use(middleware.auth())
      .use(middleware.permission({ permission: 'leaderboards.read' }))

    router
      .group(() => {
        router
          .get('', [ClubsController, 'index'])
          .use(middleware.permission({ permission: 'clubs.read' }))
        router
          .get(':id', [ClubsController, 'show'])
          .use(middleware.permission({ permission: 'clubs.read' }))
        router
          .post('', [ClubsController, 'store'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .put(':id', [ClubsController, 'update'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .post(':id/logo', [ClubsController, 'uploadLogo'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .post(':id/media/image', [ClubsController, 'uploadImageMedia'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .post(':id/media/youtube', [ClubsController, 'addYoutubeMedia'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .put(':id/delete-media', [ClubsController, 'deleteMedia'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .put(':id/registration-info', [ClubsController, 'updateRegistrationInfo'])
          .use(middleware.permission({ permission: 'clubs.manage' }))
        router
          .get(':id/members', [ClubRegistrationsController, 'members'])
          .use(middleware.permission({ permission: 'club_registrations.read' }))
        router
          .get(':id/registrations', [ClubRegistrationsController, 'index'])
          .use(middleware.permission({ permission: 'club_registrations.read' }))
        router
          .post(':id/registrations', [ClubRegistrationsController, 'store'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
        router
          .get(':id/registrations/export', [ClubRegistrationsController, 'export'])
          .use(middleware.permission({ permission: 'club_registrations.export' }))
        router
          .get(':id/member-roles', [ClubMemberRolesController, 'index'])
          .use(middleware.permission({ permission: 'club_registrations.read' }))
        router
          .get(':id/member-role-suggestions', [ClubMemberRolesController, 'suggestions'])
          .use(middleware.permission({ permission: 'club_registrations.read' }))
        router
          .post(':id/member-roles', [ClubMemberRolesController, 'store'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
      })
      .prefix('clubs')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get(':id', [ClubRegistrationsController, 'show'])
          .use(middleware.permission({ permission: 'club_registrations.read' }))
        router
          .put('member-roles/:id', [ClubMemberRolesController, 'update'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
        router
          .delete('member-roles/:id', [ClubMemberRolesController, 'destroy'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
        router
          .put('bulk-update', [ClubRegistrationsController, 'bulkUpdate'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
        router
          .put(':id', [ClubRegistrationsController, 'update'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
        router
          .delete(':id', [ClubRegistrationsController, 'delete'])
          .use(middleware.permission({ permission: 'club_registrations.manage' }))
      })
      .prefix('club-registrations')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('', [CustomFormsController, 'index'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .get('by-feature', [CustomFormsController, 'getByFeature'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .get('unattached', [CustomFormsController, 'getUnattachedForms'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .get('available-activities', [CustomFormsController, 'getAvailableActivities'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .get('available-clubs', [CustomFormsController, 'getAvailableClubs'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .get(':id', [CustomFormsController, 'show'])
          .use(middleware.permission({ permission: 'custom_forms.read' }))
        router
          .post('', [CustomFormsController, 'store'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id', [CustomFormsController, 'update'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id/attach-club', [CustomFormsController, 'attachToClub'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id/detach-club', [CustomFormsController, 'detachFromClub'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id/attach-activity', [CustomFormsController, 'attachToActivity'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id/detach-activity', [CustomFormsController, 'detachFromActivity'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .delete(':id', [CustomFormsController, 'destroy'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
        router
          .put(':id/toggle-active', [CustomFormsController, 'toggleActive'])
          .use(middleware.permission({ permission: 'custom_forms.manage' }))
      })
      .prefix('custom-forms')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('', [CertificateTemplatesController, 'index'])
          .use(middleware.permission({ permission: 'certificate.template.read' }))
        router
          .get(':id', [CertificateTemplatesController, 'show'])
          .use(middleware.permission({ permission: 'certificate.template.read' }))
        router
          .post('', [CertificateTemplatesController, 'store'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .put(':id', [CertificateTemplatesController, 'update'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/duplicate', [CertificateTemplatesController, 'duplicate'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/publish', [CertificateTemplatesController, 'publish'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/archive', [CertificateTemplatesController, 'archive'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .delete(':id', [CertificateTemplatesController, 'destroy'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/background', [CertificateTemplatesController, 'uploadBackground'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/assets', [CertificateTemplatesController, 'uploadAsset'])
          .use(middleware.permission({ permission: 'certificate.template.manage' }))
      })
      .prefix('certificate-templates')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('/code/:code', [CertificatesController, 'showByCode'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .get('/verify/:code', [CertificatesController, 'verify'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .get('/activities/:activityId/recipients', [CertificatesController, 'recipients'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .post('/prepare-issuance', [CertificatesController, 'prepare'])
          .use(middleware.permission({ permission: 'certificate.issue' }))
        router
          .post('/issue-single', [CertificatesController, 'issueSingle'])
          .use(middleware.permission({ permission: 'certificate.issue' }))
        router
          .post('/issue-bulk', [CertificatesController, 'issueBulk'])
          .use(middleware.permission({ permission: 'certificate.issue' }))
        router
          .post('/generate', [CertificatesController, 'generate'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .post('/generate-single', [CertificatesController, 'generateSingle'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .get('', [CertificatesController, 'index'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .get('/:id', [CertificatesController, 'show'])
          .use(middleware.permission({ permission: 'certificate.read' }))
        router
          .post('/:id/revoke', [CertificatesController, 'revoke'])
          .use(middleware.permission({ permission: 'certificate.revoke' }))
      })
      .prefix('certificates')
      .use(middleware.auth())
  })
  .prefix('v2')

router.get('health', () => ({ status: 'ok' }))

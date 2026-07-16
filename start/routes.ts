import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminusersController = () => import('#controllers/adminusers_controller')
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
        router.put('logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('auth')

    router
      .group(() => {
        router.get('', [AdminusersController, 'index'])
        router.get(':id', [AdminusersController, 'show'])
        router.post('', [AdminusersController, 'create'])
        router.put(':id', [AdminusersController, 'update'])
        router.put(':id/password', [AdminusersController, 'editPassword'])
      })
      .prefix('admin-users')
      .use(middleware.auth())
      .use(middleware.adminPermission({ permission: 'akunadmin' }))

    router
      .group(() => {
        router.get('stats', [DashboardController, 'stats'])
        router.get('profiles', [DashboardController, 'CountProfiles'])
        router.get('gender', [DashboardController, 'CountUsersGender'])
      })
      .prefix('dashboard')
      .use(middleware.auth())

    router
      .group(() => {
        router.post('', [UniversitiesController, 'store']).use(middleware.auth())
        router.put('/:id', [UniversitiesController, 'update']).use(middleware.auth())
        router.get('/:id', [UniversitiesController, 'show'])
        router.get('', [UniversitiesController, 'index'])
        router.delete(':id', [UniversitiesController, 'delete'])
      })
      .prefix('universities')

    router
      .group(() => {
        router.put('/:id', [ProfilesController, 'update'])
        router.put('/:id/regional-assignment', [ProfilesController, 'updateRegionalAssignment'])
        router.put('auth/:id', [AuthController, 'updateMember'])
        router.get('/:id', [ProfilesController, 'show'])
        router.get('user/:id', [ProfilesController, 'showByUserId'])
        router.get('', [ProfilesController, 'index'])
        router.delete(':id', [ProfilesController, 'delete'])
      })
      .prefix('profiles')
      .use(middleware.auth())

    router
      .group(() => {
        router.post('', [MembersController, 'store'])
        router.post(':id/generate-account', [MembersController, 'generateAccount'])
      })
      .prefix('members')
      .use(middleware.auth())

    router
      .group(() => {
        router.put('/:id', [ActivitiesController, 'update'])
        router.get('/:id', [ActivitiesController, 'show'])
        router.get('', [ActivitiesController, 'index'])
        router.post('', [ActivitiesController, 'store'])
        router.post(':id/images', [ActivitiesController, 'uploadImage'])
        router.put(':id/delete-image', [ActivitiesController, 'deleteImage'])
        router.put(':id/reorder-images', [ActivitiesController, 'reorderImages'])
        router.get(':id/registrations', [ActivityRegistrationsController, 'index'])
        router.get(':id/registrations/statistics', [ActivityRegistrationsController, 'statistics'])
        router.get(':id/registrations-export/', [ActivityRegistrationsController, 'export'])
        router.put(':id/registrations/status-by-email', [
          ActivityRegistrationsController,
          'updateStatusByListOfEmail',
        ])
        router.put(':id/registrations', [ActivityRegistrationsController, 'updateStatusBulk'])
        router.post(':id/registrations', [ActivityRegistrationsController, 'store'])
      })
      .prefix('activities')
      .use(middleware.auth())

    router
      .group(() => {
        router.put('', [ActivityRegistrationsController, 'updateStatus'])
        router.get('/:id', [ActivityRegistrationsController, 'show'])
        router.get('/user/:id', [ActivityRegistrationsController, 'getActivityByUserId'])
        router.delete(':id', [ActivityRegistrationsController, 'delete'])
      })
      .prefix('activity-registrations')
      .use(middleware.auth())

    router
      .group(() => {
        router.put('/:id', [RuangCurhatController, 'update'])
        router.get('/:id', [RuangCurhatController, 'show'])
        router.get('', [RuangCurhatController, 'index'])
      })
      .prefix('ruang-curhat')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('', [ProvincesController, 'index'])
        router.get(':id', [ProvincesController, 'show'])
        router.get(':id/cities', [CitiesController, 'getByProvinceId'])
        router.post('', [ProvincesController, 'store']).use(middleware.auth())
        router.put(':id', [ProvincesController, 'update']).use(middleware.auth())
        router.delete(':id', [ProvincesController, 'delete']).use(middleware.auth())
      })
      .prefix('provinces')

    router
      .group(() => {
        router.get('', [CitiesController, 'index'])
        router.get(':id', [CitiesController, 'show'])
        router.post('', [CitiesController, 'store']).use(middleware.auth())
        router.put(':id', [CitiesController, 'update']).use(middleware.auth())
        router.delete(':id', [CitiesController, 'delete']).use(middleware.auth())
      })
      .prefix('cities')

    router.get('countries', [CountriesController, 'index'])

    router
      .group(() => {
        router.get('', [LeaderboardsController, 'index'])
        router.get('export', [LeaderboardsController, 'export'])
        router.get(':id', [LeaderboardsController, 'show'])
        router.put(':id', [LeaderboardsController, 'update'])
        router.put(':id/approve-reject', [LeaderboardsController, 'approveReject'])
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

    router
      .group(() => {
        router.get('', [ClubsController, 'index'])
        router.get(':id', [ClubsController, 'show'])
        router.post('', [ClubsController, 'store'])
        router.put(':id', [ClubsController, 'update'])
        router.post(':id/logo', [ClubsController, 'uploadLogo'])
        router.post(':id/media/image', [ClubsController, 'uploadImageMedia'])
        router.post(':id/media/youtube', [ClubsController, 'addYoutubeMedia'])
        router.put(':id/delete-media', [ClubsController, 'deleteMedia'])
        router.put(':id/registration-info', [ClubsController, 'updateRegistrationInfo'])

        // Club registrations management
        router.get(':id/members', [ClubRegistrationsController, 'members'])
        router.get(':id/registrations', [ClubRegistrationsController, 'index'])
        router.post(':id/registrations', [ClubRegistrationsController, 'store'])
        router.get(':id/registrations/export', [ClubRegistrationsController, 'export'])

        // Club role assignments
        router.get(':id/member-roles', [ClubMemberRolesController, 'index'])
        router.get(':id/member-role-suggestions', [ClubMemberRolesController, 'suggestions'])
        router.post(':id/member-roles', [ClubMemberRolesController, 'store'])
      })
      .prefix('clubs')
      .use(middleware.auth())
      .use(middleware.adminPermission({ permission: 'club' }))

    router
      .group(() => {
        router.put('member-roles/:id', [ClubMemberRolesController, 'update'])
        router.delete('member-roles/:id', [ClubMemberRolesController, 'destroy'])
        router.put('bulk-update', [ClubRegistrationsController, 'bulkUpdate'])
        router.get(':id', [ClubRegistrationsController, 'show'])
        router.put(':id', [ClubRegistrationsController, 'update'])
        router.delete(':id', [ClubRegistrationsController, 'delete'])
      })
      .prefix('club-registrations')
      .use(middleware.auth())
      .use(middleware.adminPermission({ permission: 'club' }))

    router
      .group(() => {
        router.get('', [CustomFormsController, 'index'])
        router.get('by-feature', [CustomFormsController, 'getByFeature'])
        router.get('unattached', [CustomFormsController, 'getUnattachedForms'])
        router.get('available-activities', [CustomFormsController, 'getAvailableActivities'])
        router.get('available-clubs', [CustomFormsController, 'getAvailableClubs'])
        router.get(':id', [CustomFormsController, 'show'])
        router.post('', [CustomFormsController, 'store'])
        router.put(':id', [CustomFormsController, 'update'])
        router.put(':id/attach-club', [CustomFormsController, 'attachToClub'])
        router.put(':id/detach-club', [CustomFormsController, 'detachFromClub'])
        router.put(':id/attach-activity', [CustomFormsController, 'attachToActivity'])
        router.put(':id/detach-activity', [CustomFormsController, 'detachFromActivity'])
        router.delete(':id', [CustomFormsController, 'destroy'])
        router.put(':id/toggle-active', [CustomFormsController, 'toggleActive'])
      })
      .prefix('custom-forms')
      .use(middleware.auth())
      .use(middleware.adminPermission({ permission: 'formkustom' }))

    router
      .group(() => {
        router
          .get('', [CertificateTemplatesController, 'index'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.read' }))
        router
          .get(':id', [CertificateTemplatesController, 'show'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.read' }))
        router
          .post('', [CertificateTemplatesController, 'store'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .put(':id', [CertificateTemplatesController, 'update'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/publish', [CertificateTemplatesController, 'publish'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/archive', [CertificateTemplatesController, 'archive'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .delete(':id', [CertificateTemplatesController, 'destroy'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/background', [CertificateTemplatesController, 'uploadBackground'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
        router
          .post(':id/assets', [CertificateTemplatesController, 'uploadAsset'])
          .use(middleware.certificatePermission({ permission: 'certificate.template.manage' }))
      })
      .prefix('certificate-templates')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('', [CertificatesController, 'index'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .get('/code/:code', [CertificatesController, 'showByCode'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .get('/verify/:code', [CertificatesController, 'verify'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .post('/issue-single', [CertificatesController, 'issueSingle'])
          .use(middleware.certificatePermission({ permission: 'certificate.issue' }))
        router
          .post('/issue-bulk', [CertificatesController, 'issueBulk'])
          .use(middleware.certificatePermission({ permission: 'certificate.issue' }))
        router
          .post('/generate', [CertificatesController, 'generate'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .post('/generate-single', [CertificatesController, 'generateSingle'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .get('/:id', [CertificatesController, 'show'])
          .use(middleware.certificatePermission({ permission: 'certificate.read' }))
        router
          .post('/:id/revoke', [CertificatesController, 'revoke'])
          .use(middleware.certificatePermission({ permission: 'certificate.revoke' }))
      })
      .prefix('certificates')
      .use(middleware.auth())
  })
  .prefix('v2')

router.get('health', () => ({ status: 'ok' }))

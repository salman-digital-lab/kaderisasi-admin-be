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

router
  .group(() => {
    router
      .group(() => {
        router.post('register', [AuthController, 'register'])
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

    router
      .group(() => {
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
        router.put('/:id', [ActivitiesController, 'update'])
        router.get('/:id', [ActivitiesController, 'show'])
        router.get('', [ActivitiesController, 'index'])
        router.post('', [ActivitiesController, 'store'])
        router.post(':id/images', [ActivitiesController, 'uploadImage'])
        router.put(':id/delete-image', [ActivitiesController, 'deleteImage'])
        router.get(':id/registrations', [ActivityRegistrationsController, 'index'])
        router.get(':id/registrations-export/', [ActivityRegistrationsController, 'export'])
        router.put(':id/registrations', [ActivityRegistrationsController, 'updateStatusBulk'])
        router.post(':id/registrations', [ActivityRegistrationsController, 'store'])
      })
      .prefix('activities')
      .use(middleware.auth())

    router
      .group(() => {
        router.put('', [ActivityRegistrationsController, 'updateStatus'])
        router.get('/:id', [ActivityRegistrationsController, 'show'])
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
  })
  .prefix('v2')

router.get('health', () => ({ status: 'ok' }))
import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  /**
   * The bodyparser middleware will parse the request body
   * for the following HTTP methods.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser
   */
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * Config for the JSON parser
   */
  json: {
    convertEmptyStringsToNull: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    /**
     * Enabling auto process allows bodyparser middleware to
     * move all uploaded files inside the tmp folder of your
     * operating system
     */
    autoProcess: [
      '/v2/activities/:id/images',
      '/v2/clubs/:id/logo',
      '/v2/clubs/:id/media/image',
      '/v2/certificate-templates/:id/background',
      '/v2/certificate-templates/:id/assets',
    ],
    convertEmptyStringsToNull: true,

    /**
     * Maximum limit of data to parse including all files
     * and fields
     */
    limit: '6mb',
    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig

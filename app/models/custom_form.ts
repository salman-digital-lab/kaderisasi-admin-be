import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

type FormField = {
  key: string
  label: string
  required: boolean
  type: string
  placeholder?: string
  helpText?: string
  description?: string
  options?: FormOption[]
  validation?: FormValidation
  defaultValue?: any
  hidden?: boolean
  disabled?: boolean
}

type FormOption = {
  label: string
  value?: string | number | boolean
  disabled?: boolean
}

type FormValidation = {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  customMessage?: string
}

type FormSection = {
  section_name: string
  fields: FormField[]
}

type FormSchema = {
  fields: FormSection[]
}

export default class CustomForm extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare formName: string

  @column()
  declare formDescription: string

  @column()
  declare featureType: 'activity_registration' | 'club_registration' | 'independent_form'

  @column()
  declare featureId: number | null

  @column()
  declare formSchema: FormSchema

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

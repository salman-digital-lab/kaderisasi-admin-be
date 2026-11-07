import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

/**
 * Member emails are matched after trimming and lowercasing (login, register,
 * Google sign-in, email change), so two accounts must never differ only by
 * case. Stored emails that are not yet normalized are normalized first; that
 * cannot be undone, and rolling back only drops the index.
 *
 * The older non-unique idx_public_users_lower_email stays untouched.
 */
const indexName = 'public_users_lower_email_unique'
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`

export default class extends BaseSchema {
  static disableTransactions = true

  private async schemaName(db: QueryClientContract): Promise<string> {
    const current = await db.rawQuery('SELECT current_schema() AS name')
    const schema = current.rows[0]?.name as string | null
    if (!schema) throw new Error('A target schema is required for the email index')
    return schema
  }

  private async index(
    db: QueryClientContract,
    schema: string
  ): Promise<{ indisvalid: boolean; definition: string } | undefined> {
    const result = await db.rawQuery(
      `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_index i ON i.indexrelid=c.oid
       WHERE n.nspname=? AND c.relname=?`,
      [schema, indexName]
    )
    return result.rows[0]
  }

  async up(): Promise<void> {
    this.defer(async (db) => {
      const schema = await this.schemaName(db)
      const users = `${quote(schema)}.public_users`
      // Normalize only where the normalized value is not already taken.
      await db.rawQuery(
        `UPDATE ${users} u SET email=lower(trim(u.email)), updated_at=now()
         WHERE u.email <> lower(trim(u.email))
           AND NOT EXISTS (SELECT 1 FROM ${users} o WHERE o.id<>u.id AND lower(trim(o.email))=lower(trim(u.email)))`
      )
      const duplicates = await db.rawQuery(
        `SELECT count(*)::int AS total FROM (
           SELECT 1 FROM ${users} WHERE email IS NOT NULL GROUP BY lower(trim(email)) HAVING count(*)>1
         ) d`
      )
      const total = duplicates.rows[0].total as number
      if (total > 0)
        throw new Error(
          `${total} member emails differ only by case or spaces; merge or rename them before adding ${indexName}`
        )

      const existing = await this.index(db, schema)
      if (existing) {
        if (!/UNIQUE INDEX .* \(lower\(\(email\)::text\)\)$/.test(existing.definition))
          throw new Error(`Refusing to replace unrelated index ${indexName}`)
        if (existing.indisvalid) return
        await db.rawQuery(`DROP INDEX CONCURRENTLY ${quote(schema)}.${quote(indexName)}`)
      }
      await db.rawQuery(
        `CREATE UNIQUE INDEX CONCURRENTLY ${quote(indexName)} ON ${users} USING btree (lower(email))`
      )
    })
  }

  async down(): Promise<void> {
    this.defer(async (db) => {
      const schema = await this.schemaName(db)
      if (await this.index(db, schema))
        await db.rawQuery(`DROP INDEX CONCURRENTLY ${quote(schema)}.${quote(indexName)}`)
    })
  }
}

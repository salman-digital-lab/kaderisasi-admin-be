import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

const indexName = 'idx_public_users_lower_email'
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`
type IndexDefinition = {
  table_schema: string
  table_name: string
  method: string
  indisunique: boolean
  indisvalid: boolean
  indnkeyatts: number
  indnatts: number
  predicate: string | null
  expression: string
}

export default class extends BaseSchema {
  static disableTransactions = true

  private async inspect(db: QueryClientContract): Promise<{
    schema: string
    index?: IndexDefinition
  }> {
    const current = await db.rawQuery('SELECT current_schema() AS name')
    const schema = current.rows[0]?.name as string | null
    if (!schema) throw new Error('A target schema is required for the email index')
    const result = await db.rawQuery(
      `SELECT tn.nspname AS table_schema, t.relname AS table_name, am.amname AS method,
        i.indisunique, i.indisvalid, i.indnkeyatts, i.indnatts,
        pg_get_expr(i.indpred,i.indrelid) AS predicate,
        pg_get_indexdef(i.indexrelid,1,true) AS expression
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_index i ON i.indexrelid=c.oid JOIN pg_class t ON t.oid=i.indrelid
       JOIN pg_namespace tn ON tn.oid=t.relnamespace JOIN pg_am am ON am.oid=c.relam
       WHERE n.nspname=? AND c.relname=?`,
      [schema, indexName]
    )
    const index = result.rows[0] as IndexDefinition | undefined
    if (index) {
      const expression = index.expression.replace(/[()\s"]/g, '')
      if (
        index.table_schema !== schema ||
        index.table_name !== 'public_users' ||
        index.method !== 'btree' ||
        index.indisunique ||
        index.indnkeyatts !== 1 ||
        index.indnatts !== 1 ||
        index.predicate !== null ||
        !['loweremail', 'loweremail::text'].includes(expression)
      )
        throw new Error(`Refusing to replace unrelated index ${indexName}`)
    }
    return { schema, index }
  }

  async up(): Promise<void> {
    this.defer(async (db) => {
      const { schema, index } = await this.inspect(db)
      if (index?.indisvalid) return
      if (index) await db.rawQuery(`DROP INDEX CONCURRENTLY ${quote(schema)}.${quote(indexName)}`)
      await db.rawQuery(
        `CREATE INDEX CONCURRENTLY ${quote(indexName)} ON ${quote(schema)}.public_users USING btree (lower(email))`
      )
    })
  }

  async down(): Promise<void> {
    this.defer(async (db) => {
      const { schema, index } = await this.inspect(db)
      if (index) await db.rawQuery(`DROP INDEX CONCURRENTLY ${quote(schema)}.${quote(indexName)}`)
    })
  }
}

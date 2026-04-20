import { readFileSync } from 'node:fs'
import { lookup } from 'node:dns/promises'
import { Client } from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('SUPABASE_DB_PASSWORD manquant')
  process.exit(1)
}

const projectRef = process.env.SUPABASE_PROJECT_REF
if (!projectRef) {
  console.error('SUPABASE_PROJECT_REF manquant')
  process.exit(1)
}

// Le direct (db.<ref>.supabase.co:5432) est IPv6-only sur le free tier.
// On passe par le pooler IPv4. Région inconnue a priori → on essaie les régions communes.
const region = process.env.SUPABASE_REGION || 'eu-west-3'
const host = `aws-0-${region}.pooler.supabase.com`

const client = new Client({
  host,
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
console.log(`Connexion via pooler: ${host}:6543 (region ${region})`)

const sql = readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8')

try {
  await client.connect()
  console.log('Connecté. Application de la migration…')
  await client.query(sql)
  console.log('✅ Migration appliquée.')
  await client.end()
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(2)
}

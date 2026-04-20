import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]

if (!url || !serviceKey || !email) {
  console.error('Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node admin-reset-user.mjs <email>')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

// Liste paginée pour retrouver l'utilisateur par email.
let found = null
let page = 1
while (!found) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
  if (error) {
    console.error('listUsers error:', error.message)
    process.exit(2)
  }
  found = data.users.find((u) => u.email === email)
  if (found) break
  if (data.users.length < 100) break
  page += 1
}

if (!found) {
  console.log(`Aucun user existant avec email=${email}`)
  process.exit(0)
}

console.log(`Found user id=${found.id}, email_confirmed_at=${found.email_confirmed_at}`)

const { error } = await admin.auth.admin.deleteUser(found.id)
if (error) {
  console.error('deleteUser error:', error.message)
  process.exit(3)
}
console.log(`✅ Supprimé ${email}`)

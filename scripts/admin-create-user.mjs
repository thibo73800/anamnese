import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]
const password = process.argv[3]

if (!url || !serviceKey || !email || !password) {
  console.error('Usage: node admin-create-user.mjs <email> <password>')
  process.exit(1)
}

const admin = createClient(url, serviceKey)
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (error) {
  console.error('createUser error:', error.message)
  process.exit(2)
}
console.log(`✅ User créé: id=${data.user.id} email=${data.user.email}`)

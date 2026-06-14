import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetAuth() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('List error:', error.message);
    process.exit(1);
  }
  console.log(`Deleting ${data.users.length} users...`);
  for (const user of data.users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) console.error(`Failed ${user.id}:`, delError.message);
    else console.log(`Deleted: ${user.email || user.id}`);
  }
  console.log('Auth reset complete.');
}

resetAuth();

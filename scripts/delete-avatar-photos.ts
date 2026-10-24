// Deletes every uploaded avatar photo and the "avatars" storage bucket (section 10.1; approved by Robert, 2026-10-24).
// Lists only, unless --confirm is given.
//
//   SUPABASE_URL=https://prgflhcpnhdxbabdnqhc.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/delete-avatar-photos.ts
//   ... node scripts/delete-avatar-photos.ts --confirm
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'avatars';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const confirm = process.argv.includes('--confirm');
const db = createClient(url, key, { auth: { persistSession: false } });

/** All file paths in the bucket; uploads live in one folder per user ({userId}/avatar.jpg). */
async function listAll(prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(path))); // a folder
      else out.push(path);
    }
    if (data.length < 100) return out;
  }
}

const { data: bucket } = await db.storage.getBucket(BUCKET);
if (!bucket) {
  console.log(`No "${BUCKET}" bucket: nothing to delete.`);
  process.exit(0);
}
const files = await listAll();
console.log(`Bucket "${BUCKET}" has ${files.length} file(s):`);
for (const f of files) console.log(`  ${f}`);

if (!confirm) {
  console.log('\nNothing deleted. Run again with --confirm to delete these files and the bucket.');
  process.exit(0);
}
for (let i = 0; i < files.length; i += 100) {
  const { error } = await db.storage.from(BUCKET).remove(files.slice(i, i + 100));
  if (error) throw error;
}
const { error } = await db.storage.deleteBucket(BUCKET);
if (error) throw error;
console.log(`\nDeleted ${files.length} file(s) and the "${BUCKET}" bucket.`);

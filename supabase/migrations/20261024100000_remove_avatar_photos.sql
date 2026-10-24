-- ============================================================
-- REMOVE AVATAR PHOTO UPLOADS (LEARNSPACE_RESEARCH_UPDATE.md section 10.1; approved by Robert, 2026-10-24)
-- The app no longer uploads photos. This drops the bucket's policies and clears profile links to
-- uploaded photos; emoji ("emoji:…") and generated (DiceBear) avatars are kept.
-- The files and the bucket itself are deleted with scripts/delete-avatar-photos.ts (Storage API),
-- because Supabase does not allow deleting stored files with SQL.
-- ============================================================

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Users can upload their own avatar" on storage.objects;
    drop policy if exists "Users can update their own avatar" on storage.objects;
    drop policy if exists "Public avatar read access" on storage.objects;
  end if;
end;
$$;

update public.profiles
   set avatar_url = null
 where avatar_url like '%/storage/v1/object/public/avatars/%';

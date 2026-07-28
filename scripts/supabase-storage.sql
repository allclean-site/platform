insert into storage.buckets (id, name, public)
values ('calc-uploads', 'calc-uploads', true)
on conflict (id) do update set public = true;

drop policy if exists calc_uploads_anon_insert on storage.objects;
create policy calc_uploads_anon_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'calc-uploads');

drop policy if exists calc_uploads_public_read on storage.objects;
create policy calc_uploads_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'calc-uploads');

-- ============================================================
-- FOTOS DOS PASSEIOS (28/10/2026): a pasta "yalla-fotos" no Storage.
--   A galeria e a capa dos passeios, e as fotos que a Milla manda no
--   chat do assistente, viram arquivo aqui (antes ficavam dentro do
--   catálogo, que todo visitante do site baixa).
--   Leitura pública (o site mostra as fotos); só a dona sobe, troca ou
--   apaga. O nome leva um código aleatório.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('yalla-fotos', 'yalla-fotos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists yalla_fotos_sobe on storage.objects;
create policy yalla_fotos_sobe on storage.objects for insert to authenticated with check (bucket_id = 'yalla-fotos' and yalla.is_owner());
drop policy if exists yalla_fotos_troca on storage.objects;
create policy yalla_fotos_troca on storage.objects for update to authenticated using (bucket_id = 'yalla-fotos' and yalla.is_owner());
drop policy if exists yalla_fotos_apaga on storage.objects;
create policy yalla_fotos_apaga on storage.objects for delete to authenticated using (bucket_id = 'yalla-fotos' and yalla.is_owner());
select 'fotos da yalla prontas' as status;

-- APP DA YALLA (Milla) — o KIT DA VIAGEM com link curto e sempre atualizado (27/10/2026). Quem roda é você.
-- Onde: supabase.com → projeto da Ti Artes (uopfqlogjzuqpabptxkb) → SQL Editor → New query → colar → Run.
--
-- O que faz: uma tabela só para os kits (uma linha por cliente que comprou). O cliente lê UM kit pelo
-- código do link (a função yalla.kit), nunca a tabela inteira. Só a dona (o login da Milla, info@yallaexperiences.com) grava.
-- Não mexe em nada que já existe. Sem isto, o app usa o link comprido (funciona, mas não se atualiza).

create table if not exists yalla.kits (
  token text primary key check (token ~ '^[A-Za-z0-9]{8,32}$'),
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table yalla.kits enable row level security;

drop policy if exists kits_dona on yalla.kits;
create policy kits_dona on yalla.kits for all to authenticated
  using (yalla.is_owner()) with check (yalla.is_owner());

grant select, insert, update, delete on yalla.kits to authenticated;
revoke all on yalla.kits from anon;

-- o cliente: lê só o kit do código que ele recebeu
create or replace function yalla.kit(p_token text) returns jsonb
  language sql stable security definer set search_path = yalla, public
as $$ select dados from yalla.kits where token = p_token $$;
revoke all on function yalla.kit(text) from public;
grant execute on function yalla.kit(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- conferir: tem que aparecer tabela 1 e funcao 1 (a sala yalla já está nos Exposed schemas)
select 'tabela' as o_que, count(*) from information_schema.tables where table_schema = 'yalla' and table_name = 'kits'
union all
select 'funcao', count(*) from information_schema.routines where routine_schema = 'yalla' and routine_name = 'kit';

-- =====================================================================
-- SCRIPT SUPABASE : à coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================
-- Principe de sécurité :
--   * Le public (clé anon) peut UNIQUEMENT ajouter une candidature.
--   * Personne ne peut lire / modifier / supprimer directement la table.
--   * Le dashboard passe par des fonctions qui revérifient le mot de passe
--     admin côté serveur (hash SHA-256 stocké dans admin_config).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Table des candidatures ----------
create table if not exists public.candidatures (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  pseudo          text not null check (char_length(pseudo) between 2 and 40),
  age             int  not null check (age between 10 and 120),
  contact         text not null check (char_length(contact) between 3 and 100),
  poste           text not null check (char_length(poste) between 1 and 60),
  motivations     text not null check (char_length(motivations) between 20 and 3000),
  experience      text          check (char_length(experience) <= 3000),
  disponibilites  text not null check (char_length(disponibilites) between 2 and 500),
  statut          text not null default 'en_attente'
                  check (statut in ('en_attente', 'acceptee', 'refusee'))
);

alter table public.candidatures enable row level security;

drop policy if exists "Public peut postuler" on public.candidatures;
create policy "Public peut postuler"
  on public.candidatures
  for insert
  to anon, authenticated
  with check (statut = 'en_attente');

-- Aucune policy SELECT / UPDATE / DELETE => impossible avec la clé anon.
grant insert on public.candidatures to anon, authenticated;

-- ---------- Identifiants admin (non lisibles publiquement) ----------
create table if not exists public.admin_config (
  id            int primary key default 1 check (id = 1),
  username      text not null,
  password_hash text not null
);

alter table public.admin_config enable row level security;
-- Aucune policy => table totalement inaccessible depuis le site.

-- Mot de passe par défaut : ChangeMoi-2026!  (même hash que config.js)
insert into public.admin_config (id, username, password_hash)
values (1, 'admin', '797680ebce8bbada796936b395b8246cd61606f2de7a8212922719197ca29525')
on conflict (id) do nothing;

-- ---------- Fonctions admin ----------
create or replace function public._is_admin(p_user text, p_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.admin_config
    where username = p_user
      and password_hash = encode(digest(p_password, 'sha256'), 'hex')
  );
$$;

create or replace function public.admin_list(p_user text, p_password text)
returns setof public.candidatures
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public._is_admin(p_user, p_password) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query select * from public.candidatures order by created_at desc;
end;
$$;

create or replace function public.admin_set_statut(p_user text, p_password text, p_id bigint, p_statut text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._is_admin(p_user, p_password) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  update public.candidatures set statut = p_statut where id = p_id;
end;
$$;

create or replace function public.admin_delete(p_user text, p_password text, p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._is_admin(p_user, p_password) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  delete from public.candidatures where id = p_id;
end;
$$;

-- Droits d'exécution
revoke all on function public._is_admin(text, text) from public, anon, authenticated;
grant execute on function public.admin_list(text, text) to anon, authenticated;
grant execute on function public.admin_set_statut(text, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_delete(text, text, bigint) to anon, authenticated;

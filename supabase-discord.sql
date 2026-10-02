-- =====================================================================
-- MISE À JOUR DISCORD : à coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter UNE fois, après supabase.sql)
-- =====================================================================
-- Ajoute :
--   * discord          : pseudo Discord du candidat (obligatoire pour les nouvelles candidatures)
--   * discord_user_id  : ID Discord trouvé par le bot
--   * discord_role     : résultat de l'attribution du rôle ('ok' ou message d'erreur)
-- Le champ "contact" devient l'email (facultatif).
-- =====================================================================

alter table public.candidatures
  add column if not exists discord text check (char_length(discord) between 2 and 40),
  add column if not exists discord_user_id text,
  add column if not exists discord_role text;

alter table public.candidatures alter column contact drop not null;

-- Les visiteurs ne peuvent pas remplir eux-mêmes les colonnes gérées par le bot
drop policy if exists "Public peut postuler" on public.candidatures;
create policy "Public peut postuler"
  on public.candidatures
  for insert
  to anon, authenticated
  with check (statut = 'en_attente' and discord_user_id is null and discord_role is null);

-- Recrée la fonction de liste pour inclure les nouvelles colonnes
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

-- La fonction Discord (Edge Function) utilise la clé serveur pour vérifier l'admin
grant execute on function public._is_admin(text, text) to service_role;
grant select, update on public.candidatures to service_role;

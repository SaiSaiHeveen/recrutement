// =====================================================================
// EDGE FUNCTION SUPABASE : discord-role
// Donne le rôle Discord correspondant au poste quand une candidature est acceptée,
// puis envoie un message privé de félicitations au candidat.
//
// Secrets à définir dans Supabase > Edge Functions > Secrets :
//   DISCORD_BOT_TOKEN : le token du bot (NE JAMAIS le mettre dans le site)
//   DISCORD_GUILD_ID  : l'ID du serveur Discord
//   DISCORD_ROLES     : JSON poste -> ID du rôle, ex :
//                       {"Développeur":"123456789012345678","Helper":"234567890123456789"}
//
// Réglage obligatoire : désactiver "Verify JWT" (Enforce JWT verification)
// dans les paramètres de la fonction. La sécurité est assurée ici par la
// vérification du mot de passe admin.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISCORD_API = "https://discord.com/api/v10";

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function discord(path: string, init: RequestInit = {}) {
  const res = await fetch(DISCORD_API + path, {
    ...init,
    headers: {
      Authorization: `Bot ${Deno.env.get("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// Retrouve l'ID Discord à partir de ce que le candidat a tapé
async function findMember(guildId: string, input: string): Promise<{ id?: string; error?: string }> {
  const raw = input.trim().replace(/^@/, "");

  // Le candidat a directement donné son ID
  if (/^\d{17,20}$/.test(raw)) {
    const r = await discord(`/guilds/${guildId}/members/${raw}`);
    return r.ok ? { id: raw } : { error: "Ce membre n'est pas sur le serveur Discord." };
  }

  const name = raw.replace(/#0$/, "").replace(/#\d{4}$/, "").toLowerCase();
  const r = await discord(`/guilds/${guildId}/members/search?query=${encodeURIComponent(name)}&limit=100`);
  if (!r.ok) {
    if (r.status === 401) return { error: "Token du bot invalide (secret DISCORD_BOT_TOKEN)." };
    if (r.status === 403) return { error: "Le bot n'a pas accès au serveur (vérifie qu'il est bien invité)." };
    return { error: `Recherche Discord impossible (erreur ${r.status}).` };
  }

  const members = (r.data || []) as any[];
  const exact = members.filter(m =>
    m.user?.username?.toLowerCase() === name ||
    m.user?.global_name?.toLowerCase() === name ||
    m.nick?.toLowerCase() === name
  );
  const byUsername = exact.filter(m => m.user?.username?.toLowerCase() === name);
  const match = byUsername.length === 1 ? byUsername[0] : exact.length === 1 ? exact[0] : null;

  if (match) return { id: match.user.id };
  if (exact.length > 1) return { error: `Plusieurs membres s'appellent "${raw}", impossible de savoir lequel.` };
  return { error: `"${raw}" n'a pas été trouvé sur le serveur Discord (il doit d'abord rejoindre le serveur).` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Méthode non autorisée" }, 405);

  try {
    const { user, password, id } = await req.json();

    // Clé serveur : ancienne (service_role) ou nouvelle (SUPABASE_SECRET_KEYS)
    let supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseKey) {
      try { supabaseKey = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"))[0] as string || ""; } catch { /* ignoré */ }
    }
    if (!supabaseKey) return reply({ error: "Clé serveur Supabase introuvable dans la fonction." }, 500);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, supabaseKey);

    // 1) Vérifie que c'est bien l'admin
    const { data: isAdmin, error: adminErr } = await sb.rpc("_is_admin", { p_user: user, p_password: password });
    if (adminErr) return reply({ error: "Vérification admin impossible : " + adminErr.message }, 500);
    if (!isAdmin) return reply({ error: "Accès refusé" }, 403);

    // 2) Récupère la candidature
    const { data: c, error: cErr } = await sb.from("candidatures").select("*").eq("id", id).single();
    if (cErr || !c) return reply({ error: "Candidature introuvable." }, 404);
    if (c.statut !== "acceptee") return reply({ error: "La candidature n'est pas acceptée." }, 400);

    const save = async (fields: Record<string, unknown>) => {
      await sb.from("candidatures").update(fields).eq("id", id);
    };
    const fail = async (message: string) => {
      await save({ discord_role: message });
      return reply({ ok: false, error: message });
    };

    // 3) Config
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (!Deno.env.get("DISCORD_BOT_TOKEN") || !guildId) {
      return await fail("Secrets Discord manquants (DISCORD_BOT_TOKEN / DISCORD_GUILD_ID).");
    }
    let roles: Record<string, string> = {};
    try { roles = JSON.parse(Deno.env.get("DISCORD_ROLES") || "{}"); } catch {
      return await fail("Le secret DISCORD_ROLES n'est pas un JSON valide.");
    }
    const roleId = roles[c.poste];
    if (!roleId) return await fail(`Aucun rôle Discord configuré pour le poste "${c.poste}".`);
    if (!c.discord) return await fail("Aucun pseudo Discord sur cette candidature.");

    // 4) Trouve le membre
    let memberId = c.discord_user_id as string | null;
    if (!memberId) {
      const found = await findMember(guildId, c.discord);
      if (!found.id) return await fail(found.error!);
      memberId = found.id;
    }

    // 5) Donne le rôle
    const add = await discord(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
      method: "PUT",
      headers: { "X-Audit-Log-Reason": encodeURIComponent(`Candidature #${c.id} acceptée`) },
    });
    if (!add.ok) {
      if (add.status === 403) return await fail("Discord refuse : le rôle du bot doit être AU-DESSUS du rôle à donner et avoir la permission « Gérer les rôles ».");
      if (add.status === 404) return await fail("Membre ou rôle introuvable (vérifie les IDs dans DISCORD_ROLES).");
      return await fail(`Erreur Discord ${add.status} lors de l'ajout du rôle.`);
    }

    // 6) Message privé (facultatif : ignoré si le candidat a fermé ses MP)
    let dm = false;
    const ch = await discord(`/users/@me/channels`, { method: "POST", body: JSON.stringify({ recipient_id: memberId }) });
    if (ch.ok) {
      const msg = await discord(`/channels/${ch.data.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `🎉 Félicitations **${c.pseudo}** ! Ta candidature pour le poste **${c.poste}** a été acceptée. Ton rôle vient de t'être attribué sur le serveur, bienvenue dans l'équipe !`,
        }),
      });
      dm = msg.ok;
    }

    await save({ discord_user_id: memberId, discord_role: "ok" });
    return reply({ ok: true, dm });
  } catch (e) {
    return reply({ error: "Erreur interne : " + (e as Error).message }, 500);
  }
});

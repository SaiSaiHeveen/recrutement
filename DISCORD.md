# Rôle Discord automatique

Quand tu cliques **Accepter** dans le dashboard, le bot donne au candidat le rôle Discord du poste choisi (Développeur ou Helper) et lui envoie un message privé.

À faire **dans cet ordre**.

## 1. Mettre la base à jour (Supabase)

Supabase → **SQL Editor** → **New query** → colle tout `supabase-discord.sql` → **Run**.
⚠️ À faire **avant** de publier le site sur GitHub, sinon le formulaire ne marchera plus.

## 2. Créer le bot (Discord)

1. Va sur https://discord.com/developers/applications → **New Application** → nom `Recrutement` → **Create**.
2. Onglet **Bot** :
   - **Reset Token** → copie le token et garde-le pour l'étape 4. Ne le donne à personne.
   - Dans **Privileged Gateway Intents**, active **Server Members Intent** → **Save Changes**.
3. Onglet **OAuth2** → **URL Generator** :
   - Scopes : coche **bot**
   - Bot Permissions : coche **Manage Roles** (Gérer les rôles)
   - Copie l'URL en bas, ouvre-la, choisis ton serveur → **Autoriser**.
4. Sur ton serveur : **Paramètres du serveur → Rôles** → fais glisser le rôle du bot **au-dessus** de « Développeur » et « Helper » → Enregistrer.

(Tu peux aussi réutiliser un bot existant : il faut juste les points 2, 3 et 4.)

## 3. Récupérer les IDs (Discord)

1. Discord → **Paramètres utilisateur → Avancés** → active **Mode développeur**.
2. Clic droit sur l'icône du serveur → **Copier l'identifiant du serveur**.
3. **Paramètres du serveur → Rôles** → clic droit sur « Développeur » → **Copier l'identifiant du rôle**. Pareil pour « Helper ».

## 4. Ajouter les secrets (Supabase)

Supabase → **Edge Functions** → **Secrets** → ajoute :

| Name | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | le token du bot |
| `DISCORD_GUILD_ID` | l'ID du serveur |
| `DISCORD_ROLES` | `{"Développeur":"ID_ROLE_DEV","Helper":"ID_ROLE_HELPER"}` |

Les noms des postes dans `DISCORD_ROLES` doivent être écrits **exactement** comme dans `config.js` (accents compris).

## 5. Créer la fonction (Supabase)

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : `discord-role` (exactement).
3. Efface le code d'exemple, colle tout le contenu de `supabase/functions/discord-role/index.ts` → **Deploy function**.
4. Une fois déployée, ouvre la fonction → **Details** (ou Settings) → **désactive « Verify JWT »** (Enforce JWT verification) → **Save**.
   C'est obligatoire : la fonction vérifie elle-même ton mot de passe admin.

## 6. Publier le site

GitHub Desktop → coche tous les fichiers → Summary `Rôle Discord automatique` → **Commit to main** → **Push origin**.

## Tester

1. Rejoins ton serveur avec un compte (ou demande à un ami), envoie une candidature avec ce pseudo Discord.
2. Dashboard → **Accepter** → un message « Rôle Discord attribué ✔ » s'affiche.
3. En cas d'erreur, le message explique quoi corriger. Corrige, puis ouvre la candidature → **↻ Donner le rôle Discord**.

Pour désactiver la fonction : mets `DISCORD_AUTO_ROLE: false` dans `config.js`.

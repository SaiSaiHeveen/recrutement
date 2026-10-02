# Site de candidature (GitHub Pages + Supabase)

Site 100 % statique : `index.html`, `candidature.html`, `admin.html`, `dashboard.html`, `hash.html`, `config.js`, `style.css`, `script.js`.
Les candidatures sont stockées dans Supabase (`supabase.sql`).

Identifiant par défaut : `admin`, mot de passe par défaut : `ChangeMoi-2026!`. **Change-le** (voir plus bas).

---

## 1. Créer le projet Supabase

1. Va sur https://supabase.com, clique **Start your project** et connecte-toi (avec GitHub, c'est le plus simple).
2. Clique **New project** :
   - **Name** : `candidatures` (ou ce que tu veux)
   - **Database Password** : clique *Generate a password* et garde-le de côté (il ne sert pas au site)
   - **Region** : la plus proche (ex. *West EU (Paris)* ou *Central EU (Frankfurt)*)
   - Plan **Free**, puis **Create new project**. Attends 1 à 2 minutes.
3. Dans le menu de gauche : **SQL Editor** → **New query**.
4. Ouvre `supabase.sql`, copie tout, colle-le, clique **Run**. Tu dois voir *Success. No rows returned*.
5. Vérifie dans **Table Editor** : les tables `candidatures` et `admin_config` existent.

## 2. Récupérer l'URL et la clé « anon »

1. Clique **Connect** en haut du projet, ou va dans **Project Settings** (roue crantée en bas à gauche).
2. **URL** : *Project Settings → Data API* (ou *API*) → **Project URL**, du type `https://abcdefgh.supabase.co`.
3. **Clé** : *Project Settings → API Keys*.
   - Onglet **Legacy API keys** → clé **anon / public** (longue chaîne commençant par `eyJ...`)
   - ou bien la **Publishable key** (`sb_publishable_...`) : les deux fonctionnent.
   - ⚠️ Ne copie **jamais** la clé `service_role` / `secret`.
4. Colle les deux valeurs dans `config.js` (`SUPABASE_URL` et `SUPABASE_ANON_KEY`).

## 3. Changer le mot de passe admin

1. Ouvre `hash.html` (double-clic sur le fichier, ou en ligne), tape ton nouveau mot de passe, clique **Générer**.
2. Copie le hash dans `config.js` → `ADMIN_PASSWORD_HASH`.
3. Copie la requête SQL affichée et exécute-la dans Supabase → SQL Editor.
4. Pour changer aussi l'identifiant : modifie `ADMIN_USERNAME` dans `config.js` **et** exécute
   `update public.admin_config set username = 'nouvel_identifiant' where id = 1;`

## 4. Mettre en ligne avec GitHub Desktop + GitHub Pages

1. Crée un compte sur https://github.com et installe **GitHub Desktop** (https://desktop.github.com). Connecte-toi : *File → Options → Accounts → Sign in*.
2. Dans GitHub Desktop : **File → Add local repository** → choisis le dossier du site.
   Il dira *« This directory does not appear to be a Git repository »* → clique **create a repository**, puis **Create repository**.
3. Clique **Publish repository** (en haut).
   - Décoche **Keep this code private** (GitHub Pages gratuit nécessite un dépôt public).
   - Clique **Publish repository**.
4. Sur github.com, ouvre ton dépôt → **Settings** → **Pages** (menu de gauche).
   - **Source** : *Deploy from a branch*
   - **Branch** : `main` et dossier `/ (root)` → **Save**.
5. Attends 1 à 2 minutes, recharge la page : l'adresse s'affiche, du type
   `https://ton-pseudo.github.io/nom-du-depot/`.
6. Pour chaque modification ensuite : modifie les fichiers → dans GitHub Desktop, écris un résumé en bas à gauche → **Commit to main** → **Push origin**. Le site se met à jour en ~1 minute (fais Ctrl+F5 pour vider le cache).

## 5. Tester

1. Ouvre le site, va sur **Postuler**, envoie une candidature de test.
2. Va sur `/admin.html`, connecte-toi, la candidature apparaît dans le dashboard.
3. En cas d'erreur, le message affiché explique quoi vérifier (clé, script SQL, mot de passe…). Le détail technique est dans la console du navigateur (F12).

## Sécurité : ce qu'il faut savoir

- Sur un site statique, tout le code est public (y compris `config.js`). La vérification du hash dans le navigateur sert uniquement à l'interface.
- La **vraie** protection est dans Supabase : avec la clé publique, on peut seulement *ajouter* une candidature. Lire, accepter, refuser ou supprimer passe par des fonctions qui revérifient le mot de passe côté serveur. Sans le mot de passe, personne ne peut lire les données des candidats.
- Le hash étant visible publiquement, choisis un mot de passe **long et unique** (12+ caractères).
- Le mot de passe reste dans le `sessionStorage` de l'onglet tant que tu es connecté : clique **Déconnexion** sur un ordinateur partagé.

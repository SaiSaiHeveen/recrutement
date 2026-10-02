/* =====================================================================
   CONFIGURATION DU SITE
   =====================================================================

   1) SUPABASE
      - SUPABASE_URL      : Supabase > Project Settings > API (ou "Data API")
                            ex : https://abcdefghijkl.supabase.co
      - SUPABASE_ANON_KEY : Supabase > Project Settings > API Keys
                            -> clé "anon public" (onglet "Legacy API keys")
                            ou clé "Publishable" (commence par sb_publishable_)
      Ces deux valeurs sont PUBLIQUES par nature : elles peuvent être dans
      le site sans danger, la sécurité est assurée par les règles (RLS)
      du fichier supabase.sql. Ne mets JAMAIS la clé "service_role"
      ou "secret" ici.

   2) IDENTIFIANTS ADMIN
      - ADMIN_USERNAME      : l'identifiant de connexion
      - ADMIN_PASSWORD_HASH : le hash SHA-256 du mot de passe (jamais le
                              mot de passe en clair)


      COMMENT CHANGER LE MOT DE PASSE :
      a) Génère le hash du nouveau mot de passe, au choix :
         - Ouvre la page hash.html du site (en local ou en ligne), tape
           ton mot de passe, clique "Générer" et copie le résultat.
         - OU dans PowerShell (Windows) :
             $s=[Security.Cryptography.SHA256]::Create(); ($s.ComputeHash([Text.Encoding]::UTF8.GetBytes('MonNouveauMotDePasse')) | % { $_.ToString('x2') }) -join ''
         - OU sur Mac/Linux :
             printf '%s' 'MonNouveauMotDePasse' | shasum -a 256
      b) Colle le hash ci-dessous dans ADMIN_PASSWORD_HASH.
      c) Mets AUSSI à jour le hash dans Supabase (SQL Editor) :
             update public.admin_config
             set username = 'admin', password_hash = 'COLLE_LE_HASH_ICI'
             where id = 1;
         (Supabase revérifie le mot de passe côté serveur : sans cette
         étape, tu pourras te connecter mais pas lire les candidatures.)
      d) Choisis un mot de passe LONG (12+ caractères, mélangé) : le hash
         est visible publiquement dans ce fichier, un mot de passe faible
         pourrait être retrouvé par force brute.
   ===================================================================== */

const CONFIG = {
  SITE_NAME: "Recrutement",
  SITE_TAGLINE: "Rejoins l'équipe et fais partie de l'aventure.",

  SUPABASE_URL: "https://hxqzlpyxthfqsutkoolv.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_I8iMH-OGYNDr--ANDPts1Q_B-6DCIDM",

  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "a74cd24a2c814c2ec90424c6caff0e5bd50414276092061b8c1da79c24d39ddd",

  // Postes proposés dans le formulaire
  POSTES: ["Développeur", "Helper"],

  AGE_MIN: 13,
  AGE_MAX: 99
};

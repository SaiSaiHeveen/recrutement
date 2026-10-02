/* =====================================================================
   SCRIPT COMMUN À TOUTES LES PAGES
   La page courante est détectée via <body data-page="...">
   ===================================================================== */

const SESSION_KEY = "candid_admin_session";

/* ---------- Utilitaires ---------- */

// Échappe le HTML pour afficher sans risque le texte saisi par les candidats
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toast(message, type = "info") {
  let zone = document.querySelector(".toast-zone");
  if (!zone) {
    zone = document.createElement("div");
    zone.className = "toast-zone";
    document.body.appendChild(zone);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function showAlert(el, message, type = "error") {
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideAlert(el) {
  el.classList.add("hidden");
}

function setLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label || "Chargement..."}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.label || btn.innerHTML;
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

const STATUT_LABELS = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée"
};

function isSupabaseConfigured() {
  return typeof CONFIG !== "undefined"
    && CONFIG.SUPABASE_URL
    && !CONFIG.SUPABASE_URL.includes("VOTRE-PROJET")
    && CONFIG.SUPABASE_ANON_KEY
    && !CONFIG.SUPABASE_ANON_KEY.includes("VOTRE_CLE");
}

let _client = null;
function getClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase n'est pas configuré : renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans config.js.");
  }
  if (!window.supabase) {
    throw new Error("Impossible de charger Supabase (vérifie ta connexion internet ou un bloqueur de pub).");
  }
  if (!_client) _client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return _client;
}

// Traduit les erreurs techniques en messages lisibles
function friendlyError(err) {
  const msg = (err && (err.message || err.toString())) || "";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Impossible de joindre le serveur. Vérifie ta connexion internet et réessaie.";
  if (/Accès refusé|42501|permission denied/i.test(msg)) return "Accès refusé par la base de données. Vérifie que le mot de passe dans Supabase (table admin_config) correspond à celui de config.js.";
  if (/violates check constraint/i.test(msg)) return "Certaines informations ne respectent pas le format attendu. Vérifie les champs et réessaie.";
  if (/Invalid API key|JWT|apikey/i.test(msg)) return "Clé Supabase invalide. Vérifie SUPABASE_ANON_KEY dans config.js.";
  if (/discord/i.test(msg) && /column|Could not find/i.test(msg)) return "La base n'est pas à jour : exécute supabase-discord.sql dans Supabase (SQL Editor).";
  if (/does not exist|Could not find/i.test(msg)) return "La table ou les fonctions n'existent pas encore. As-tu exécuté supabase.sql dans Supabase ?";
  return msg || "Une erreur inattendue est survenue.";
}

/* ---------- Session admin ---------- */

function getSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return s && s.user && s.pwd ? s : null;
  } catch {
    return null;
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "admin.html";
}

/* ---------- Éléments communs ---------- */

function initCommon() {
  document.querySelectorAll("[data-site-name]").forEach(el => (el.textContent = CONFIG.SITE_NAME));
  document.querySelectorAll("[data-site-tagline]").forEach(el => (el.textContent = CONFIG.SITE_TAGLINE));
  document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));

  // Apparition au scroll
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(el => el.classList.add("visible"));
  }
}

/* =====================================================================
   PAGE : CANDIDATURE
   ===================================================================== */
function initCandidature() {
  const form = document.getElementById("candidature-form");
  const alertBox = document.getElementById("form-alert");
  const submitBtn = document.getElementById("submit-btn");
  const posteSelect = document.getElementById("poste");

  CONFIG.POSTES.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    posteSelect.appendChild(opt);
  });

  const ageInput = document.getElementById("age");
  ageInput.min = CONFIG.AGE_MIN;
  ageInput.max = CONFIG.AGE_MAX;

  // Compteurs de caractères
  document.querySelectorAll("textarea[maxlength]").forEach(t => {
    const counter = document.querySelector(`[data-counter="${t.id}"]`);
    if (!counter) return;
    const update = () => (counter.textContent = `${t.value.length} / ${t.maxLength}`);
    t.addEventListener("input", update);
    update();
  });

  const rules = {
    pseudo: v => (v.length < 2 || v.length > 40) ? "Le pseudo doit contenir entre 2 et 40 caractères." : "",
    age: v => {
      const n = Number(v);
      if (!v || !Number.isInteger(n)) return "Indique ton âge (nombre entier).";
      if (n < CONFIG.AGE_MIN) return `Tu dois avoir au moins ${CONFIG.AGE_MIN} ans pour postuler.`;
      if (n > CONFIG.AGE_MAX) return "Âge invalide.";
      return "";
    },
    discord: v => {
      const name = v.replace(/^@/, "");
      if (!name) return "Indique ton pseudo Discord.";
      if (!/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(name) && !/^\d{17,20}$/.test(name)) {
        return "Pseudo Discord invalide : indique ton nom d'utilisateur (lettres, chiffres, _ et . uniquement), pas ton surnom.";
      }
      return "";
    },
    contact: v => {
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Cette adresse email n'est pas valide.";
      return "";
    },
    poste: v => !v ? "Choisis un poste." : "",
    motivations: v => v.length < 20 ? "Développe un peu plus tes motivations (20 caractères minimum)." : "",
    experience: () => "",
    disponibilites: v => v.length < 2 ? "Indique tes disponibilités." : "",
    rgpd: (_, el) => !el.checked ? "Tu dois accepter pour envoyer ta candidature." : ""
  };

  function validateField(name) {
    const el = form.elements[name];
    const field = el.closest(".field");
    const error = rules[name](el.value.trim(), el);
    field.classList.toggle("invalid", !!error);
    const msg = field.querySelector(".error-msg");
    if (msg) msg.textContent = error;
    return !error;
  }

  Object.keys(rules).forEach(name => {
    const el = form.elements[name];
    el.addEventListener("blur", () => validateField(name));
    el.addEventListener("input", () => {
      if (el.closest(".field").classList.contains("invalid")) validateField(name);
    });
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    hideAlert(alertBox);

    // Anti-spam : champ caché que seuls les robots remplissent
    if (form.elements.website.value) return;

    const results = Object.keys(rules).map(validateField);
    if (results.includes(false)) {
      showAlert(alertBox, "Certains champs sont incomplets ou invalides. Corrige les éléments en rouge.");
      form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea")?.focus();
      form.classList.add("shake");
      setTimeout(() => form.classList.remove("shake"), 500);
      return;
    }

    // Anti double-envoi rapide
    const last = Number(localStorage.getItem("candid_last_submit") || 0);
    if (Date.now() - last < 60_000) {
      showAlert(alertBox, "Tu viens déjà d'envoyer une candidature. Patiente une minute avant de réessayer.");
      return;
    }

    const data = {
      pseudo: form.elements.pseudo.value.trim(),
      age: Number(form.elements.age.value),
      discord: form.elements.discord.value.trim().replace(/^@/, ""),
      contact: form.elements.contact.value.trim() || null,
      poste: form.elements.poste.value,
      motivations: form.elements.motivations.value.trim(),
      experience: form.elements.experience.value.trim() || null,
      disponibilites: form.elements.disponibilites.value.trim()
    };

    setLoading(submitBtn, true, "Envoi en cours...");
    try {
      const { error } = await getClient().from("candidatures").insert(data);
      if (error) throw error;

      localStorage.setItem("candid_last_submit", String(Date.now()));
      document.getElementById("success-pseudo").textContent = data.pseudo;
      document.getElementById("form-card").classList.add("hidden");
      document.getElementById("success-card").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      showAlert(alertBox, "L'envoi a échoué : " + friendlyError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });

  document.getElementById("new-application")?.addEventListener("click", () => {
    form.reset();
    form.querySelectorAll("textarea").forEach(t => t.dispatchEvent(new Event("input")));
    document.getElementById("success-card").classList.add("hidden");
    document.getElementById("form-card").classList.remove("hidden");
  });
}

/* =====================================================================
   PAGE : CONNEXION ADMIN
   ===================================================================== */
function initAdmin() {
  if (getSession()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("login-form");
  const alertBox = document.getElementById("login-alert");
  const btn = document.getElementById("login-btn");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    hideAlert(alertBox);

    const user = form.elements.username.value.trim();
    const pwd = form.elements.password.value;

    if (!user || !pwd) {
      showAlert(alertBox, "Renseigne l'identifiant et le mot de passe.");
      return;
    }

    setLoading(btn, true, "Vérification...");
    try {
      const hash = await sha256(pwd);
      // Petit délai pour ralentir les essais en boucle
      await new Promise(r => setTimeout(r, 600));

      if (user === CONFIG.ADMIN_USERNAME && hash === CONFIG.ADMIN_PASSWORD_HASH.toLowerCase()) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, pwd, at: Date.now() }));
        window.location.href = "dashboard.html";
      } else {
        showAlert(alertBox, "Identifiant ou mot de passe incorrect.");
        form.elements.password.value = "";
        form.elements.password.focus();
        document.getElementById("login-card").classList.add("shake");
        setTimeout(() => document.getElementById("login-card").classList.remove("shake"), 500);
      }
    } catch (err) {
      console.error(err);
      showAlert(alertBox, "Ton navigateur ne permet pas la vérification sécurisée (crypto.subtle). Ouvre le site en HTTPS (GitHub Pages) ou via localhost.");
    } finally {
      setLoading(btn, false);
    }
  });
}

/* =====================================================================
   PAGE : DASHBOARD
   ===================================================================== */
function initDashboard() {
  const session = getSession();
  if (!session) {
    window.location.replace("admin.html");
    return;
  }

  document.getElementById("admin-name").textContent = session.user;
  document.getElementById("logout-btn").addEventListener("click", logout);

  const tbody = document.getElementById("candidatures-body");
  const alertBox = document.getElementById("dash-alert");
  const searchInput = document.getElementById("search");
  const filterSelect = document.getElementById("filter");
  const refreshBtn = document.getElementById("refresh-btn");

  let candidatures = [];

  async function rpc(fn, params = {}) {
    const { data, error } = await getClient().rpc(fn, { p_user: session.user, p_password: session.pwd, ...params });
    if (error) throw error;
    return data;
  }

  async function load() {
    hideAlert(alertBox);
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Chargement...</td></tr>`;
    try {
      candidatures = (await rpc("admin_list")) || [];
      render();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Impossible de charger les candidatures.</td></tr>`;
      showAlert(alertBox, friendlyError(err));
    }
  }

  function updateStats() {
    const count = s => candidatures.filter(c => c.statut === s).length;
    document.getElementById("stat-total").textContent = candidatures.length;
    document.getElementById("stat-pending").textContent = count("en_attente");
    document.getElementById("stat-accepted").textContent = count("acceptee");
    document.getElementById("stat-refused").textContent = count("refusee");
  }

  function render() {
    updateStats();
    const q = searchInput.value.trim().toLowerCase();
    const f = filterSelect.value;

    const list = candidatures.filter(c =>
      (f === "all" || c.statut === f) &&
      (!q || c.pseudo.toLowerCase().includes(q))
    );

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">${candidatures.length ? "Aucune candidature ne correspond à ta recherche." : "Aucune candidature pour le moment."}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((c, i) => `
      <tr style="animation-delay:${Math.min(i, 15) * 30}ms">
        <td data-label="Pseudo"><strong>${escapeHtml(c.pseudo)}</strong></td>
        <td data-label="Poste">${escapeHtml(c.poste)}</td>
        <td data-label="Discord">${escapeHtml(c.discord || c.contact || "-")} ${discordBadge(c)}</td>
        <td data-label="Date">${formatDate(c.created_at)}</td>
        <td data-label="Statut"><span class="status status-${escapeHtml(c.statut)}">${STATUT_LABELS[c.statut] || escapeHtml(c.statut)}</span></td>
        <td data-label="Actions">
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-action="view" data-id="${c.id}">Voir</button>
            ${c.statut !== "acceptee" ? `<button class="btn btn-success btn-sm" data-action="acceptee" data-id="${c.id}">Accepter</button>` : ""}
            ${c.statut !== "refusee" ? `<button class="btn btn-danger btn-sm" data-action="refusee" data-id="${c.id}">Refuser</button>` : ""}
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${c.id}" title="Supprimer">🗑</button>
          </div>
        </td>
      </tr>`).join("");
  }

  function discordBadge(c) {
    if (c.statut !== "acceptee" || !c.discord) return "";
    if (c.discord_role === "ok") return `<span class="status status-acceptee" title="Rôle Discord attribué">rôle ✔</span>`;
    if (c.discord_role) return `<span class="status status-refusee" title="${escapeHtml(c.discord_role)}">rôle ✖</span>`;
    return "";
  }

  // Appelle l'Edge Function Supabase qui donne le rôle Discord
  async function giveDiscordRole(id) {
    const c = candidatures.find(x => x.id === id);
    if (!c || !CONFIG.DISCORD_AUTO_ROLE) return;
    if (!c.discord) {
      toast("Pas de pseudo Discord sur cette candidature : rôle non attribué. Ajoute-le dans Supabase (colonne discord) puis clique « Donner le rôle Discord ».", "error");
      return;
    }

    toast("Attribution du rôle Discord...");
    let result;
    try {
      const { data, error } = await getClient().functions.invoke("discord-role", {
        body: { user: session.user, password: session.pwd, id }
      });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      result = data;
    } catch (err) {
      console.error(err);
      const msg = /Failed to send|Failed to fetch|not found|404/i.test(err.message)
        ? "La fonction Discord n'est pas encore installée dans Supabase (Edge Function « discord-role »)."
        : err.message;
      c.discord_role = msg;
      render();
      toast("Rôle Discord non attribué : " + msg, "error");
      return;
    }

    if (result && result.ok) {
      c.discord_role = "ok";
      toast(result.dm ? "Rôle Discord attribué ✔ + message privé envoyé" : "Rôle Discord attribué ✔ (MP fermés, message non envoyé)", "success");
    } else {
      c.discord_role = (result && result.error) || "Erreur inconnue";
      toast("Rôle Discord non attribué : " + c.discord_role, "error");
    }
    render();
    if (!modal.classList.contains("hidden")) openModal(id);
  }

  async function setStatut(id, statut) {
    try {
      await rpc("admin_set_statut", { p_id: id, p_statut: statut });
      const c = candidatures.find(x => x.id === id);
      if (c) c.statut = statut;
      render();
      toast(statut === "acceptee" ? "Candidature acceptée ✔" : "Candidature refusée", statut === "acceptee" ? "success" : "error");
      closeModal();
      if (statut === "acceptee") giveDiscordRole(id);
    } catch (err) {
      console.error(err);
      toast(friendlyError(err), "error");
    }
  }

  async function remove(id) {
    const c = candidatures.find(x => x.id === id);
    if (!confirm(`Supprimer définitivement la candidature de "${c ? c.pseudo : id}" ?\nCette action est irréversible.`)) return;
    try {
      await rpc("admin_delete", { p_id: id });
      candidatures = candidatures.filter(x => x.id !== id);
      render();
      toast("Candidature supprimée", "success");
      closeModal();
    } catch (err) {
      console.error(err);
      toast(friendlyError(err), "error");
    }
  }

  /* ----- Modal détail ----- */
  const modal = document.getElementById("detail-modal");
  const modalBody = document.getElementById("modal-body");

  function openModal(id) {
    const c = candidatures.find(x => x.id === id);
    if (!c) return;
    const d = (k, v) => `<div class="detail"><div class="k">${k}</div><div class="v">${escapeHtml(v) || "<em>Non renseigné</em>"}</div></div>`;
    document.getElementById("modal-title").textContent = c.pseudo;
    modalBody.innerHTML = `
      <p style="margin-bottom:16px"><span class="status status-${escapeHtml(c.statut)}">${STATUT_LABELS[c.statut]}</span>
        <span style="color:var(--muted);font-size:.85rem;margin-left:8px">Reçue le ${formatDate(c.created_at)}</span></p>
      <div class="detail-grid">
        ${d("Pseudo", c.pseudo)}
        ${d("Âge", c.age + " ans")}
        ${d("Discord", c.discord)}
        ${d("Email", c.contact)}
        ${d("Poste visé", c.poste)}
        ${c.statut === "acceptee" && c.discord ? d("Rôle Discord", c.discord_role === "ok" ? "✔ Attribué" : c.discord_role ? "✖ " + c.discord_role : "Pas encore attribué") : ""}
      </div>
      ${d("Motivations", c.motivations)}
      ${d("Expérience", c.experience)}
      ${d("Disponibilités", c.disponibilites)}
      <div class="modal-actions">
        ${c.statut !== "acceptee" ? `<button class="btn btn-success" data-action="acceptee" data-id="${c.id}">✔ Accepter</button>` : ""}
        ${c.statut !== "refusee" ? `<button class="btn btn-danger" data-action="refusee" data-id="${c.id}">✖ Refuser</button>` : ""}
        ${c.statut === "acceptee" && c.discord && c.discord_role !== "ok" ? `<button class="btn btn-primary" data-action="discord" data-id="${c.id}">↻ Donner le rôle Discord</button>` : ""}
        <button class="btn btn-ghost" data-action="delete" data-id="${c.id}">🗑 Supprimer</button>
      </div>`;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest(".modal-close")) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });

  /* ----- Délégation des clics ----- */
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    if (action === "view") openModal(id);
    else if (action === "delete") remove(id);
    else if (action === "discord") giveDiscordRole(id);
    else setStatut(id, action);
  });

  searchInput.addEventListener("input", render);
  filterSelect.addEventListener("change", render);
  refreshBtn.addEventListener("click", load);

  load();
}

/* =====================================================================
   PAGE : OUTIL DE HASH
   ===================================================================== */
function initHash() {
  const form = document.getElementById("hash-form");
  const out = document.getElementById("hash-result");
  const outBox = document.getElementById("hash-box");
  const alertBox = document.getElementById("hash-alert");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    hideAlert(alertBox);
    const pwd = form.elements.pwd.value;
    if (pwd.length < 12) {
      showAlert(alertBox, "Conseil : utilise au moins 12 caractères (le hash est public, un mot de passe court peut être deviné).", "info");
    }
    try {
      const hash = await sha256(pwd);
      out.textContent = hash;
      document.getElementById("hash-sql").textContent =
        `update public.admin_config set password_hash = '${hash}' where id = 1;`;
      outBox.classList.remove("hidden");
    } catch {
      showAlert(alertBox, "crypto.subtle indisponible : ouvre cette page en HTTPS ou via localhost.");
    }
  });

  document.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = document.getElementById(btn.dataset.copy).textContent;
      try {
        await navigator.clipboard.writeText(text);
        toast("Copié !", "success");
      } catch {
        toast("Copie impossible, sélectionne le texte manuellement.", "error");
      }
    });
  });
}

/* =====================================================================
   DÉMARRAGE
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initCommon();
  const page = document.body.dataset.page;
  if (page === "candidature") initCandidature();
  if (page === "admin") initAdmin();
  if (page === "dashboard") initDashboard();
  if (page === "hash") initHash();
});

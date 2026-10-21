/* ==========================================================================
   analyse.js — page d'analyse des réponses du questionnaire
   - lit les réponses dans la Google Sheet (via le script Google, voir apps-script.gs) ;
   - nettoie les données (réponses complètes, incohérences, montants extrêmes) ;
   - calcule : échantillon, profil, test A/B, seuils de prix Van Westendorp, critères, budget ;
   - redessine tout à chaque actualisation (toutes les 60 secondes, ou au clic).
   ========================================================================== */
(function () {
  "use strict";


  /* ---------- 1. RÉGLAGES : c'est ici que tu modifies les valeurs ---------- */

  // Adresse du script Google publié en « Application Web » (déploiement qui lit et enregistre les réponses).
  // Le questionnaire (../questionnaire-ab/script.js) peut garder son ancienne adresse : les deux écrivent dans la même feuille.
  const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbw-Yq5laeyPgtQzpiKOMbN0MlfbJ9OjLAnXHnIvIHWYQB2S3OPV5kqQMKx0e1lUTYPb/exec";
  const SECONDES_ENTRE_ACTUALISATIONS = 60;

  // Un prix de billet hors de cette fourchette (en €) est signalé comme « extrême ».
  const BORNES_BILLET = [1, 500];
  // Idem pour le budget total par personne.
  const BORNES_BUDGET = [1, 2000];

  // Prix du test A/B (voir VERSIONS dans ../questionnaire-ab/script.js) : à adapter si ces prix changent.
  const VERSIONS = {
    A: { prix: 49, coupe: false },
    B: { prix: 54.5, coupe: false },
    C: { prix: 49, coupe: true },
    D: { prix: 54.5, coupe: true },
  };
  // Prix repères tracés sur les courbes et détaillés dans le tableau de chaque parc.
  const PRIX_REFERENCE = { asterix: [49, 54.5], disney: [79] };

  const PARCS = { asterix: "Parc Astérix", disney: "Disneyland Paris" };
  const DU_PARC = { asterix: "le Parc Astérix", disney: "Disneyland Paris" };   // pour les phrases
  const MIN_COURBES = 5;       // en dessous : pas de courbes Van Westendorp
  const MIN_INTERVALLES = 10;  // en dessous : pas d'intervalle de confiance
  const MIN_FIABLE = 30;       // en dessous : message de prudence

  // Ordre d'affichage des réponses (celui du questionnaire).
  const ORDRES = {
    situation_familiale: ["Célibataire sans enfant", "En couple sans enfant", "En couple avec enfant(s)", "Parent seul avec enfant(s)", "Autre"],
    situation: ["Étudiant(e)", "En activité", "Sans emploi", "Retraité(e)", "Autre"],
    residence: ["Île-de-France", "Hauts-de-France", "Autre région de France", "Hors de France"],
    frequence: ["Plusieurs fois par an", "Environ une fois par an", "Tous les deux ou trois ans", "Moins d'une fois tous les trois ans", "Jamais"],
    occasions: ["Vacances scolaires", "Week-end", "Anniversaire", "Sortie entre amis", "Sortie en famille", "Événement saisonnier (Halloween, Noël…)", "Sortie organisée (école, entreprise, association)", "Autre"],
    visite: ["Jamais", "Une fois", "Souvent"],
    achat_billet: ["Achat personnel sur le site du parc", "Achat personnel via un revendeur ou un site de réduction", "Comité d'entreprise ou CSE", "Cadeau", "Offre d'une marque ou d'un partenaire", "Pass annuel", "Je n'ai jamais acheté ni reçu de billet"],
    affluence: ["Peu de monde", "Raisonnable", "Beaucoup de monde", "Saturé", "Je ne sais pas"],
    accompagnement: ["Seul(e)", "En couple", "Entre amis", "En famille avec enfants", "En famille sans enfants", "Autre"],
  };
  const CRITERES = {
    importance_prix: "Le prix du billet",
    importance_attractions: "Les attractions et les sensations fortes",
    importance_univers: "L'univers et les décors",
    importance_spectacles: "Les spectacles",
    importance_enfants: "Les activités adaptées aux enfants",
    importance_attente: "Le temps d'attente",
    importance_acces: "La facilité d'accès",
  };
  const TRANCHES_AGE = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 64], [65, 120]];
  const TRANCHES_BUDGET = [[0, 50], [50, 100], [100, 150], [150, 200], [200, 300], [300, Infinity]];

  // Les 4 questions Van Westendorp, dans l'ordre où elles sont posées (+ couleur et nom de leur courbe).
  const COURBES = [
    { cle: "tc", colonne: "vw_trop_bon_marche", couleur: "var(--vw-tc)", tirets: true, nom: "Trop bon marché", court: "suspect, on douterait de la qualité" },
    { cle: "ba", colonne: "vw_bonne_affaire", couleur: "var(--vw-ba)", tirets: false, nom: "Bonne affaire", court: "une bonne affaire" },
    { cle: "ch", colonne: "vw_cher", couleur: "var(--vw-ch)", tirets: false, nom: "Cher", court: "cher, mais encore achetable" },
    { cle: "tt", colonne: "vw_trop_cher", couleur: "var(--vw-tt)", tirets: true, nom: "Trop cher", court: "trop cher pour l'acheter" },
  ];
  const POINTS_VW = [
    { cle: "pmc", code: "PMC", nom: "Prix plancher", aide: "en dessous, trop de répondants doutent de la qualité" },
    { cle: "opp", code: "OPP", nom: "Prix optimal", aide: "le moins de répondants rebutés, que ce soit par un prix trop bas ou trop haut" },
    { cle: "ipp", code: "IPP", nom: "Prix d'indifférence", aide: "autant de répondants le trouvent bon marché que cher" },
    { cle: "pme", code: "PME", nom: "Prix plafond", aide: "au-dessus, trop de répondants renoncent à acheter" },
  ];


  /* ---------- 2. PETITS OUTILS ---------- */

  const NBSP = " ";

  function el(balise, classe, texte) {
    const e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined && texte !== null) e.textContent = texte;
    return e;
  }

  function svgEl(balise, attributs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", balise);
    Object.keys(attributs || {}).forEach(function (cle) { e.setAttribute(cle, attributs[cle]); });
    return e;
  }

  function texte(valeur) { return String(valeur === undefined || valeur === null ? "" : valeur).trim(); }

  // Accepte 45, "45", "45,5" ; renvoie NaN pour une case vide.
  function num(valeur) {
    if (typeof valeur === "number") return valeur;
    if (texte(valeur) === "") return NaN;
    return Number(texte(valeur).replace(/\s/g, "").replace(",", "."));
  }

  function pct(part, decimales) {
    return (part * 100).toLocaleString("fr-FR", { maximumFractionDigits: decimales || 0 }) + NBSP + "%";
  }
  function nombre(x, decimales) {
    return x.toLocaleString("fr-FR", { minimumFractionDigits: decimales || 0, maximumFractionDigits: decimales === undefined ? 1 : decimales });
  }
  function euros(x) {
    const entier = Number.isInteger(x);
    return x.toLocaleString("fr-FR", { minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2 }) + NBSP + "€";
  }
  function arrondirDemi(x) { return Math.round(x * 2) / 2; }
  // Nombre avec son signe (+ ou −) ; un écart nul s'écrit simplement 0
  function signe(x, decimales) {
    const valeur = Math.abs(x).toLocaleString("fr-FR", { maximumFractionDigits: decimales || 0 });
    return valeur === "0" ? "0" : (x < 0 ? "−" : "+") + valeur;
  }
  function pluriel(n, singulier, plur) { return n > 1 ? plur : singulier; }
  function heure(date) { return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  function jour(date) { return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }

  function moyenne(t) { return t.reduce(function (a, b) { return a + b; }, 0) / t.length; }
  // Quantile par interpolation (tableau déjà trié)
  function quantile(trie, q) {
    if (!trie.length) return NaN;
    const position = (trie.length - 1) * q, bas = Math.floor(position), haut = Math.ceil(position);
    return trie[bas] + (trie[haut] - trie[bas]) * (position - bas);
  }
  function trier(t) { return t.slice().sort(function (a, b) { return a - b; }); }

  // Premier indice dont la valeur est >= x (bas) ou > x (haut), dans un tableau trié
  function borneBasse(tri, x) { let a = 0, b = tri.length; while (a < b) { const m = (a + b) >> 1; if (tri[m] < x) a = m + 1; else b = m; } return a; }
  function borneHaute(tri, x) { let a = 0, b = tri.length; while (a < b) { const m = (a + b) >> 1; if (tri[m] <= x) a = m + 1; else b = m; } return a; }

  // Intervalle de confiance à 95 % d'une proportion (méthode de Wilson, fiable même avec peu de réponses)
  function wilson(k, n) {
    if (!n) return [NaN, NaN];
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const centre = (p + z * z / (2 * n)) / d;
    const marge = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, centre - marge), Math.min(1, centre + marge)];
  }

  // Intervalle de confiance à 95 % de l'écart entre deux proportions (méthode de Newcombe)
  function newcombe(k1, n1, k2, n2) {
    const p1 = k1 / n1, p2 = k2 / n2, a = wilson(k1, n1), b = wilson(k2, n2), d = p1 - p2;
    return [d - Math.sqrt(Math.pow(p1 - a[0], 2) + Math.pow(b[1] - p2, 2)),
            d + Math.sqrt(Math.pow(a[1] - p1, 2) + Math.pow(p2 - b[0], 2))];
  }

  // Test exact de Fisher (bilatéral) : valable même avec de petits effectifs
  const logFactorielles = [0];
  function logFact(n) {
    for (let i = logFactorielles.length; i <= n; i++) logFactorielles[i] = logFactorielles[i - 1] + Math.log(i);
    return logFactorielles[n];
  }
  function fisher(k1, n1, k2, n2) {
    const K = k1 + k2, N = n1 + n2;
    const logProba = function (k) {
      return logFact(n1) - logFact(k) - logFact(n1 - k) + logFact(n2) - logFact(K - k) - logFact(n2 - K + k) - logFact(N) + logFact(K) + logFact(N - K);
    };
    const observee = Math.exp(logProba(k1));
    let somme = 0;
    for (let k = Math.max(0, K - n2); k <= Math.min(n1, K); k++) {
      const p = Math.exp(logProba(k));
      if (p <= observee * (1 + 1e-9)) somme += p;
    }
    return Math.min(1, somme);
  }
  function formaterP(p) {
    return p < 0.001 ? "p < 0,001" : "p = " + p.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  // Générateur pseudo-aléatoire à graine fixe : les intervalles ne « bougent » pas d'une actualisation à l'autre
  function generateur(graine) {
    return function () {
      graine |= 0; graine = graine + 0x6D2B79F5 | 0;
      let t = Math.imul(graine ^ graine >>> 15, 1 | graine);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }


  /* ---------- 3. ANALYSE : LES CALCULS ---------- */

  function lignesEnObjets(donnees) {
    return donnees.lignes.map(function (ligne) {
      const objet = {};
      donnees.colonnes.forEach(function (colonne, i) { objet[colonne] = ligne[i] === undefined ? "" : ligne[i]; });
      return objet;
    });
  }

  // Compte les réponses d'une liste de textes, dans l'ordre du questionnaire ; les réponses imprévues viennent à la fin.
  function compter(valeurs, ordre) {
    const comptes = {};
    valeurs.forEach(function (v) { if (v !== "") comptes[v] = (comptes[v] || 0) + 1; });
    const resultat = ordre.map(function (nom) { return { nom: nom, n: comptes[nom] || 0 }; });
    Object.keys(comptes).filter(function (nom) { return ordre.indexOf(nom) === -1; })
      .sort(function (a, b) { return comptes[b] - comptes[a]; })
      .forEach(function (nom) { resultat.push({ nom: nom, n: comptes[nom] }); });
    return resultat;
  }
  function eclater(valeur) { return texte(valeur) === "" ? [] : texte(valeur).split("|").map(texte).filter(Boolean); }

  // Range les valeurs dans des tranches [bas, haut]. Pour des âges (entiers), la borne haute est comprise ;
  // pour des montants, elle ne l'est pas (la tranche suivante commence à cette valeur).
  function repartir(valeurs, tranches, hautInclus) {
    return tranches.map(function (t) {
      return {
        bas: t[0], haut: t[1],
        n: valeurs.filter(function (v) { return v >= t[0] && (hautInclus ? v <= t[1] : v < t[1]); }).length,
      };
    });
  }

  function analyser(donnees) {
    const lignes = lignesEnObjets(donnees);
    const completes = lignes.filter(function (l) { return texte(l.statut) === "complet"; });
    const filtrees = lignes.filter(function (l) { return texte(l.statut) === "filtré"; });
    return {
      recus: donnees.recus, tests: donnees.tests, doublons: donnees.doublons,
      lignes: lignes, completes: completes, filtrees: filtrees,
      ab: analyserAB(completes),
      vw: { asterix: sujetsVW(completes, "asterix"), disney: sujetsVW(completes, "disney") },
    };
  }

  /* --- Test A/B --- */

  function analyserAB(completes) {
    const par = {};
    Object.keys(VERSIONS).forEach(function (v) { par[v] = { n: 0, k: 0, debut: null, fin: null }; });
    let total = 0, asterix = 0;
    completes.forEach(function (l) {
      const v = texte(l.version), choix = texte(l.choix_ab);
      if (!par[v] || (choix !== "Asterix" && choix !== "Disneyland")) return;
      const g = par[v];
      g.n++; total++;
      if (choix === "Asterix") { g.k++; asterix++; }
      const date = new Date(l.horodatage);
      if (!isNaN(date)) {
        if (!g.debut || date < g.debut) g.debut = date;
        if (!g.fin || date > g.fin) g.fin = date;
      }
    });
    const somme = function (versions) {
      return versions.reduce(function (a, v) { return { n: a.n + par[v].n, k: a.k + par[v].k }; }, { n: 0, k: 0 });
    };
    return {
      par: par, total: total, asterix: asterix,
      prix: { bas: somme(["A", "C"]), haut: somme(["B", "D"]) },
      coupe: { sans: somme(["A", "B"]), avec: somme(["C", "D"]) },
    };
  }

  function comparer(g1, g2) {
    if (!g1.n || !g2.n) return null;
    return {
      p1: g1.k / g1.n, p2: g2.k / g2.n, ecart: g1.k / g1.n - g2.k / g2.n,
      ic: newcombe(g1.k, g1.n, g2.k, g2.n), p: fisher(g1.k, g1.n, g2.k, g2.n),
    };
  }

  /* --- Van Westendorp --- */

  // Retient, pour un parc, les répondants complets dont les 4 seuils sont renseignés.
  // Compte aussi les réponses incohérentes et extrêmes (écartées ou non selon les réglages).
  function sujetsVW(completes, parc) {
    const reglages = lireReglages();
    const colonnes = COURBES.map(function (c) { return c.colonne + "_" + parc; });
    const resultat = { sujets: [], total: 0, incoherents: 0, extremes: 0 };
    completes.forEach(function (l) {
      const v = colonnes.map(function (c) { return num(l[c]); });
      if (v.some(isNaN)) return;
      resultat.total++;
      const incoherent = texte(l["incoherent_vw_" + parc]) === "oui";
      const extreme = v.some(function (x) { return x < BORNES_BILLET[0] || x > BORNES_BILLET[1]; });
      if (incoherent) resultat.incoherents++;
      if (extreme) resultat.extremes++;
      if (reglages.incoherents && incoherent) return;
      if (reglages.extremes && extreme) return;
      resultat.sujets.push({ tc: v[0], ba: v[1], ch: v[2], tt: v[3] });
    });
    return resultat;
  }

  function trierSujets(sujets) {
    const tri = {};
    COURBES.forEach(function (c) { tri[c.cle] = trier(sujets.map(function (s) { return s[c.cle]; })); });
    return tri;
  }

  // Part des répondants, pour chaque prix x de 0 à xmax :
  // « trop bon marché » et « bonne affaire » baissent quand le prix monte (seuil >= x),
  // « cher » et « trop cher » montent (seuil <= x).
  function calculerCourbes(tri, xmax, pas) {
    const n = tri.tc.length, k = Math.round(xmax / pas);
    const c = { x: [], tc: [], ba: [], ch: [], tt: [] };
    for (let i = 0; i <= k; i++) {
      const x = i * pas;
      c.x.push(x);
      c.tc.push((n - borneBasse(tri.tc, x)) / n);
      c.ba.push((n - borneBasse(tri.ba, x)) / n);
      c.ch.push(borneHaute(tri.ch, x) / n);
      c.tt.push(borneHaute(tri.tt, x) / n);
    }
    return c;
  }

  // Premier croisement de deux courbes (changement de signe de f - g), par interpolation
  function croisement(x, f, g) {
    for (let i = 0; i < x.length; i++) {
      const d = f[i] - g[i];
      if (Math.abs(d) < 1e-12) return { x: x[i], y: f[i] };
      if (i + 1 < x.length) {
        const e = f[i + 1] - g[i + 1];
        if (d * e < 0) {
          const t = d / (d - e);
          return { x: x[i] + t * (x[i + 1] - x[i]), y: f[i] + t * (f[i + 1] - f[i]) };
        }
      }
    }
    return null;
  }

  // Les 4 points classiques : « pas bon marché » = 1 − bonne affaire, « pas cher » = 1 − cher.
  function calculerPoints(c) {
    const pasBonMarche = c.ba.map(function (v) { return 1 - v; });
    const pasCher = c.ch.map(function (v) { return 1 - v; });
    return {
      pmc: croisement(c.x, c.tc, pasBonMarche),
      opp: croisement(c.x, c.tc, c.tt),
      ipp: croisement(c.x, c.ba, c.ch),
      pme: croisement(c.x, c.tt, pasCher),
    };
  }

  // Intervalle de confiance à 95 % de chaque point, par rééchantillonnage (bootstrap)
  function intervallesVW(sujets, xmax) {
    const alea = generateur(20261021), tirages = 300, resultat = {};
    POINTS_VW.forEach(function (p) { resultat[p.cle] = []; });
    for (let b = 0; b < tirages; b++) {
      const echantillon = [];
      for (let i = 0; i < sujets.length; i++) echantillon.push(sujets[Math.floor(alea() * sujets.length)]);
      const points = calculerPoints(calculerCourbes(trierSujets(echantillon), xmax, 1));
      POINTS_VW.forEach(function (p) { if (points[p.cle]) resultat[p.cle].push(points[p.cle].x); });
    }
    const intervalles = {};
    POINTS_VW.forEach(function (p) {
      const t = trier(resultat[p.cle]);
      intervalles[p.cle] = t.length >= tirages * 0.8 ? [quantile(t, 0.025), quantile(t, 0.975)] : null;
    });
    return intervalles;
  }


  /* ---------- 4. AFFICHAGE : INFOBULLE, BARRES, TABLEAUX ---------- */

  // Une seule infobulle pour toute la page : la valeur d'abord, puis son libellé.
  const bulle = el("div", "bulle");
  bulle.hidden = true;
  bulle.setAttribute("role", "tooltip");
  document.body.appendChild(bulle);

  function montrerBulle(titre, lignes, x, y) {
    bulle.replaceChildren();
    if (titre) bulle.appendChild(el("div", "t", titre));
    lignes.forEach(function (l) {
      const rangee = el("div", "l");
      if (l.couleur) {
        const cle = el("span", "k");
        cle.style.setProperty("--c", l.couleur);
        if (l.tirets) cle.style.borderTopStyle = "dashed";
        rangee.appendChild(cle);
      }
      rangee.appendChild(el("b", null, l.valeur));
      rangee.appendChild(el("span", null, l.libelle));
      bulle.appendChild(rangee);
    });
    bulle.hidden = false;
    const largeur = bulle.offsetWidth, hauteur = bulle.offsetHeight;
    let gauche = x + 14, haut = y + 14;
    if (gauche + largeur > window.innerWidth - 8) gauche = x - largeur - 14;
    if (haut + hauteur > window.innerHeight - 8) haut = y - hauteur - 14;
    bulle.style.left = Math.max(8, gauche) + "px";
    bulle.style.top = Math.max(8, haut) + "px";
  }
  function cacherBulle() { bulle.hidden = true; }

  // La même infobulle s'affiche au survol et au clavier (focus)
  function brancherBulle(cible, titre, lignes) {
    cible.addEventListener("pointermove", function (e) { montrerBulle(titre, lignes, e.clientX, e.clientY); });
    cible.addEventListener("pointerleave", cacherBulle);
    cible.addEventListener("focus", function () {
      const r = cible.getBoundingClientRect();
      montrerBulle(titre, lignes, r.left + Math.min(r.width / 2, 180), r.top + r.height / 2);
    });
    cible.addEventListener("blur", cacherBulle);
  }

  // Chiffres clés : { valeur, libelle, petit, cle }
  function chiffres(liste, classe) {
    const boite = el("div", classe || "kpis");
    liste.forEach(function (c) {
      const k = el("div", "kpi" + (c.cle ? " cle" : ""));
      if (c.etiquette) k.appendChild(el("em", null, c.etiquette));
      k.appendChild(el("b", "num", c.valeur));
      k.appendChild(el("span", null, c.libelle));
      if (c.petit) k.appendChild(el("small", null, c.petit));
      boite.appendChild(k);
    });
    return boite;
  }

  // Tableau de données : la version « sans souris » de chaque graphique
  function tableau(entetes, lignes, legende, enRepli) {
    const boite = el("div", "tablebox");
    const t = el("table");
    if (legende) t.appendChild(el("caption", null, legende));
    const tete = el("thead"), rangeeTete = el("tr");
    entetes.forEach(function (h, i) {
      const th = el("th", i ? "n" : null, h);
      th.scope = "col";
      rangeeTete.appendChild(th);
    });
    tete.appendChild(rangeeTete);
    t.appendChild(tete);
    const corps = el("tbody");
    lignes.forEach(function (ligne) {
      const rangee = el("tr");
      ligne.forEach(function (v, i) {
        const cellule = el(i ? "td" : "th", i ? "n" : null, String(v));
        if (!i) cellule.scope = "row";
        rangee.appendChild(cellule);
      });
      corps.appendChild(rangee);
    });
    t.appendChild(corps);
    boite.appendChild(t);
    if (!enRepli) return boite;
    const d = el("details", "vue-tableau");
    d.appendChild(el("summary", null, "Voir en tableau"));
    d.appendChild(boite);
    return d;
  }

  // Barres horizontales. lignes : { nom, detail, valeur, texte, ic: [bas, haut], bulle: [{valeur, libelle}] }
  // « echelle » est la valeur qui remplit toute la piste (1 pour des parts de 0 à 100 %).
  function barres(lignes, echelle) {
    const grille = el("div", "barres");
    lignes.forEach(function (l) {
      const ligne = el("div", "b-ligne focalisable");
      ligne.tabIndex = 0;
      const nom = el("div", "b-nom", l.nom);
      if (l.detail) nom.appendChild(el("small", null, l.detail));
      const piste = el("div", "b-piste");
      const barre = el("div", "b-barre");
      barre.style.width = Math.max(0, l.valeur) / echelle * 100 + "%";
      piste.appendChild(barre);
      let fin = l.valeur;
      if (l.ic && !isNaN(l.ic[0])) {
        const ic = el("div", "b-ic");
        ic.style.left = l.ic[0] / echelle * 100 + "%";
        ic.style.width = (l.ic[1] - l.ic[0]) / echelle * 100 + "%";
        piste.appendChild(ic);
        fin = Math.max(fin, l.ic[1]);
      }
      const val = el("span", "b-val", l.texte);
      val.style.left = fin / echelle * 100 + "%";
      piste.appendChild(val);
      ligne.appendChild(nom);
      ligne.appendChild(piste);
      brancherBulle(ligne, l.nom + (l.detail ? " · " + l.detail : ""), l.bulle);
      grille.appendChild(ligne);
    });
    return grille;
  }

  function carte(titre, sous, classe) {
    const c = el("div", "carte" + (classe ? " " + classe : ""));
    c.appendChild(el("h3", null, titre));
    if (sous) c.appendChild(el("p", "sous", sous));
    return c;
  }

  // Carte « parts de réponses » : une barre par réponse possible.
  // base = nombre de répondants (pour un choix multiple, le total des parts dépasse 100 %).
  function carteCategories(titre, sous, comptes, base) {
    const c = carte(titre, sous);
    if (!base) { c.appendChild(el("p", "vide", "Pas encore de réponses.")); return c; }
    const lignes = comptes.map(function (x) {
      const part = x.n / base;
      return {
        nom: x.nom, valeur: part, texte: pct(part) + " · " + x.n,
        bulle: [{ valeur: pct(part, 1), libelle: "des répondants" }, { valeur: x.n + " sur " + base, libelle: pluriel(x.n, "réponse", "réponses") }],
      };
    });
    c.appendChild(barres(lignes, 1));
    c.appendChild(tableau(["Réponse", "Répondants", "Part"],
      comptes.map(function (x) { return [x.nom, x.n, pct(x.n / base, 1)]; }), null, true));
    return c;
  }

  function carteChoixUnique(titre, sous, valeurs, ordre) {
    const v = valeurs.filter(function (x) { return x !== ""; });
    return carteCategories(titre, sous, compter(v, ordre), v.length);
  }
  function carteChoixMultiple(titre, sous, completes, colonne, ordre) {
    const reponses = completes.map(function (l) { return eclater(l[colonne]); }).filter(function (r) { return r.length; });
    const toutes = [].concat.apply([], reponses);
    return carteCategories(titre, sous, compter(toutes, ordre), reponses.length);
  }


  /* ---------- 5. LES SECTIONS DE LA PAGE ---------- */

  function sectionEchantillon(a) {
    const frag = document.createDocumentFragment();
    frag.appendChild(chiffres([
      { valeur: nombre(a.recus), libelle: "lignes reçues dans la feuille" },
      { valeur: nombre(a.tests), libelle: pluriel(a.tests, "ligne de test écartée", "lignes de test écartées") },
      { valeur: nombre(a.doublons), libelle: pluriel(a.doublons, "doublon écarté", "doublons écartés"), petit: "même numéro de répondant" },
      { valeur: nombre(a.filtrees.length), libelle: "filtrés : moins de 18 ans" },
      { valeur: nombre(a.completes.length), libelle: pluriel(a.completes.length, "réponse complète", "réponses complètes"), petit: "base de l'analyse", cle: true },
    ]));
    if (a.completes.length && a.completes.length < MIN_FIABLE) {
      frag.appendChild(el("p", "note", "Moins de " + MIN_FIABLE + " réponses complètes pour l'instant : les résultats ci-dessous sont indicatifs et vont bouger avec les nouvelles réponses."));
    }

    // Répartition des réponses entre les 4 versions du test
    const c = carte("Réponses par version du test A/B", "Le tirage au sort vise autant de réponses pour chaque version.");
    const versions = Object.keys(VERSIONS);
    const maxN = Math.max.apply(null, versions.map(function (v) { return a.ab.par[v].n; }).concat([1]));
    c.appendChild(barres(versions.map(function (v) {
      const g = a.ab.par[v];
      return {
        nom: v + " · " + euros(VERSIONS[v].prix), detail: VERSIONS[v].coupe ? "avec coupe-file" : "sans coupe-file",
        valeur: g.n, texte: String(g.n),
        bulle: [{ valeur: String(g.n), libelle: pluriel(g.n, "réponse complète", "réponses complètes") }],
      };
    }), maxN));
    c.appendChild(tableau(["Version", "Offre", "Réponses", "Première", "Dernière"],
      versions.map(function (v) {
        const g = a.ab.par[v];
        return [v, euros(VERSIONS[v].prix) + (VERSIONS[v].coupe ? " + coupe-file" : ""), g.n, g.debut ? jour(g.debut) : "—", g.fin ? jour(g.fin) : "—"];
      }), null, true));
    frag.appendChild(c);
    return frag;
  }

  function sectionProfil(a) {
    const frag = document.createDocumentFragment();
    const ages = a.completes.map(function (l) { return num(l.age); }).filter(function (x) { return !isNaN(x); });
    const tries = trier(ages);
    if (ages.length) {
      frag.appendChild(chiffres([
        { valeur: nombre(moyenne(ages), 1) + " ans", libelle: "âge moyen" },
        { valeur: nombre(quantile(tries, 0.5), 1) + " ans", libelle: "âge médian" },
        { valeur: tries[0] + " à " + tries[tries.length - 1] + " ans", libelle: "âge minimum et maximum" },
      ]));
    }
    const grille = el("div", "grille");
    const tranches = repartir(ages, TRANCHES_AGE, true).map(function (t) {
      return { nom: t.haut === 120 ? t.bas + " ans et plus" : t.bas + " à " + t.haut + " ans", n: t.n };
    });
    grille.appendChild(carteCategories("Âge", "Répondants de 18 ans et plus.", tranches, ages.length));
    grille.appendChild(carteChoixUnique("Situation familiale", null, a.completes.map(function (l) { return texte(l.situation_familiale); }), ORDRES.situation_familiale));
    grille.appendChild(carteChoixUnique("Situation", null, a.completes.map(function (l) { return texte(l.situation); }), ORDRES.situation));
    grille.appendChild(carteChoixUnique("Lieu de résidence", null, a.completes.map(function (l) { return texte(l.residence); }), ORDRES.residence));
    frag.appendChild(grille);
    return frag;
  }

  function sectionHabitudes(a) {
    const c = a.completes;
    const col = function (nom) { return c.map(function (l) { return texte(l[nom]); }); };
    const grille = el("div", "grille");
    grille.appendChild(carteChoixUnique("Fréquence de visite d'un parc d'attractions", null, col("frequence"), ORDRES.frequence));
    grille.appendChild(carteChoixMultiple("Occasions", "Plusieurs réponses possibles : le total dépasse 100 %. Question non posée à ceux qui ne vont jamais dans un parc.", c, "occasions", ORDRES.occasions));
    grille.appendChild(carteChoixUnique("Visites du Parc Astérix", null, col("visite_asterix"), ORDRES.visite));
    grille.appendChild(carteChoixUnique("Visites de Disneyland Paris", null, col("visite_disney"), ORDRES.visite));
    grille.appendChild(carteChoixMultiple("Comment les billets ont été obtenus", "Plusieurs réponses possibles.", c, "achat_billet", ORDRES.achat_billet));
    grille.appendChild(carteChoixMultiple("Avec qui envisager la visite", "Plusieurs réponses possibles.", c, "accompagnement", ORDRES.accompagnement));
    grille.appendChild(carteChoixUnique("Affluence perçue au Parc Astérix", null, col("affluence_asterix"), ORDRES.affluence));
    grille.appendChild(carteChoixUnique("Affluence perçue à Disneyland Paris", null, col("affluence_disney"), ORDRES.affluence));
    return grille;
  }

  /* --- Test A/B --- */

  function sectionAB(a) {
    const frag = document.createDocumentFragment();
    const ab = a.ab;
    if (!ab.total) {
      frag.appendChild(el("p", "vide", "Pas encore de réponses au test A/B."));
      return frag;
    }
    frag.appendChild(chiffres([
      { valeur: pct(ab.asterix / ab.total), libelle: "choisissent le Parc Astérix, toutes versions confondues", petit: ab.asterix + " sur " + ab.total, cle: true },
      { valeur: pct((ab.total - ab.asterix) / ab.total), libelle: "choisissent Disneyland Paris", petit: (ab.total - ab.asterix) + " sur " + ab.total },
    ]));

    // Part qui choisit Astérix, pour chaque version
    const c = carte("Part qui choisit le Parc Astérix, par version", "Barre : part observée. Trait : intervalle de confiance à 95 % (il est large quand il y a peu de réponses).");
    const versions = Object.keys(VERSIONS);
    c.appendChild(barres(versions.map(function (v) {
      const g = ab.par[v];
      const ligne = { nom: v + " · " + euros(VERSIONS[v].prix), detail: VERSIONS[v].coupe ? "avec coupe-file" : "sans coupe-file" };
      if (!g.n) {
        return Object.assign(ligne, { valeur: 0, texte: "aucune réponse", bulle: [{ valeur: "0", libelle: "réponse pour cette version" }] });
      }
      const ic = wilson(g.k, g.n);
      return Object.assign(ligne, {
        valeur: g.k / g.n, ic: ic, texte: pct(g.k / g.n) + " · " + g.k + "/" + g.n,
        bulle: [
          { valeur: pct(g.k / g.n, 1), libelle: "choisissent Astérix" },
          { valeur: g.k + " sur " + g.n, libelle: "répondants" },
          { valeur: pct(ic[0]) + " à " + pct(ic[1]), libelle: "intervalle à 95 %" },
        ],
      });
    }), 1));
    c.appendChild(tableau(["Version", "Offre", "Répondants", "Choisissent Astérix", "Part", "IC 95 %"],
      versions.map(function (v) {
        const g = ab.par[v], ic = wilson(g.k, g.n);
        return [v, euros(VERSIONS[v].prix) + (VERSIONS[v].coupe ? " + coupe-file" : ""), g.n, g.k,
          g.n ? pct(g.k / g.n, 1) : "—", g.n ? pct(ic[0]) + " à " + pct(ic[1]) : "—"];
      }), null, true));
    frag.appendChild(c);

    // Les deux effets, mesurés avec les mêmes réponses
    const effets = el("div", "effets");
    effets.appendChild(carteEffet(
      "Effet du prix", euros(VERSIONS.A.prix) + " contre " + euros(VERSIONS.B.prix),
      { nom: euros(VERSIONS.A.prix) + " (versions A + C)", g: ab.prix.bas },
      { nom: euros(VERSIONS.B.prix) + " (versions B + D)", g: ab.prix.haut },
      "à " + euros(VERSIONS.A.prix) + " qu'à " + euros(VERSIONS.B.prix), "à " + euros(VERSIONS.B.prix) + " qu'à " + euros(VERSIONS.A.prix)));
    effets.appendChild(carteEffet(
      "Effet du coupe-file", "avec contre sans",
      { nom: "Avec coupe-file (versions C + D)", g: ab.coupe.avec },
      { nom: "Sans coupe-file (versions A + B)", g: ab.coupe.sans },
      "avec coupe-file que sans", "sans coupe-file qu'avec"));
    frag.appendChild(effets);

    // Collecte à des périodes différentes : l'écart peut venir de la période, pas seulement de l'offre
    const periodes = versions.map(function (v) { return ab.par[v]; }).filter(function (g) { return g.n && g.debut; });
    let separees = false;
    periodes.forEach(function (g1) {
      periodes.forEach(function (g2) { if (g1.fin < g2.debut) separees = true; });
    });
    if (separees) {
      frag.appendChild(el("p", "note", "Les versions n'ont pas toutes été collectées sur la même période (voir « Réponses par version » plus haut). Si l'écart entre deux versions vient aussi de la période ou du public touché, on ne peut pas l'attribuer au seul prix ou au seul coupe-file."));
    }
    return frag;
  }

  function carteEffet(titre, sous, groupe1, groupe2, phrase1, phrase2) {
    const e = el("div", "effet");
    e.appendChild(el("h3", null, titre + " · " + sous));
    const res = comparer(groupe1.g, groupe2.g);
    if (!res) {
      e.appendChild(el("p", "vide", "Comparaison impossible : il manque encore des réponses pour " + (!groupe1.g.n ? groupe1.nom : groupe2.nom) + "."));
      return e;
    }
    if (res.p < 0.05) e.classList.add("signif");
    const grand = el("div", "grand num", signe(res.ecart * 100) + " pts");
    grand.appendChild(el("small", null, "d'écart sur la part qui choisit Astérix"));
    e.appendChild(grand);
    const dl = el("dl");
    [
      [groupe1.nom, pct(res.p1) + " · " + groupe1.g.k + "/" + groupe1.g.n],
      [groupe2.nom, pct(res.p2) + " · " + groupe2.g.k + "/" + groupe2.g.n],
      ["Écart (IC à 95 %)", signe(res.ecart * 100) + " [" + signe(res.ic[0] * 100) + " ; " + signe(res.ic[1] * 100) + "] pts"],
      ["Test exact de Fisher", formaterP(res.p)],
    ].forEach(function (ligne) {
      dl.appendChild(el("dt", null, ligne[0]));
      dl.appendChild(el("dd", null, ligne[1]));
    });
    e.appendChild(dl);
    let verdict;
    if (res.p < 0.05) {
      verdict = "Écart significatif au seuil de 5 % : Astérix est choisi plus souvent " + (res.ecart > 0 ? phrase1 : phrase2) + ".";
    } else {
      verdict = "Écart non significatif au seuil de 5 % : on ne peut pas conclure à un effet" +
        (Math.min(groupe1.g.n, groupe2.g.n) < MIN_FIABLE ? ", et l'effectif est encore faible (moins de " + MIN_FIABLE + " réponses dans un groupe)." : ".");
    }
    e.appendChild(el("p", "verdict-court", verdict));
    return e;
  }

  /* --- Van Westendorp --- */

  const observateurs = [];   // pour arrêter de suivre les anciens graphiques quand on redessine la page

  function sectionPrix(a) {
    const frag = document.createDocumentFragment();
    ["asterix", "disney"].forEach(function (parc) { frag.appendChild(carteVW(parc, a.vw[parc])); });
    const aide = el("details", "aide");
    aide.appendChild(el("summary", null, "Comment lire ce graphique"));
    const liste = el("ul");
    [
      "Chaque courbe est la part des répondants qui jugent un prix donné « trop bon marché », « une bonne affaire », « cher » ou « trop cher ». Les deux premières baissent quand le prix monte, les deux autres montent.",
      "Prix plancher (PMC) : croisement de « trop bon marché » et de « pas une bonne affaire ». En dessous, trop de répondants doutent de la qualité.",
      "Prix optimal (OPP) : croisement de « trop bon marché » et de « trop cher ». C'est le prix qui rebute le moins de monde.",
      "Prix d'indifférence (IPP) : croisement de « bonne affaire » et de « cher ». Autant de répondants le trouvent bon marché que cher.",
      "Prix plafond (PME) : croisement de « trop cher » et de « pas cher ». Au-dessus, trop de répondants renoncent.",
      "La zone teintée, entre le prix plancher et le prix plafond, est la fourchette de prix acceptable.",
    ].forEach(function (phrase) { liste.appendChild(el("li", null, phrase)); });
    aide.appendChild(liste);
    frag.appendChild(aide);
    return frag;
  }

  function carteVW(parc, vw) {
    const c = carte(PARCS[parc], null, "large");
    const retenus = vw.sujets.length;
    c.appendChild(el("p", "sous",
      retenus + " " + pluriel(retenus, "répondant retenu", "répondants retenus") + " sur " + vw.total + " " + pluriel(vw.total, "réponse complète", "réponses complètes") +
      " · repérés : " + vw.incoherents + " " + pluriel(vw.incoherents, "incohérent", "incohérents") + ", " + vw.extremes + " avec un montant extrême" +
      " · écartés de l'analyse : " + (vw.total - retenus) + "."));
    if (retenus < MIN_COURBES) {
      c.appendChild(el("p", "vide", "Pas assez de réponses pour tracer les courbes (minimum " + MIN_COURBES + " répondants retenus)."));
      return c;
    }
    if (retenus < MIN_FIABLE) {
      c.appendChild(el("p", "note", "Moins de " + MIN_FIABLE + " répondants retenus : lecture indicative, les points peuvent bouger sensiblement avec de nouvelles réponses."));
    }

    const tri = trierSujets(vw.sujets);
    const xmax = Math.max(100, Math.ceil(Math.min(300, quantile(tri.tt, 0.97) * 1.25) / 10) * 10);
    const courbes = calculerCourbes(tri, xmax, 0.5);
    const points = calculerPoints(courbes);
    const intervalles = retenus >= MIN_INTERVALLES ? intervallesVW(vw.sujets, xmax) : {};

    // Légende (toujours présente) puis graphique
    const legende = el("div", "legende");
    COURBES.forEach(function (k) {
      const item = el("span");
      const cle = el("i", "trait" + (k.tirets ? " tirets" : ""));
      cle.style.setProperty("--c", k.couleur);
      item.appendChild(cle);
      item.appendChild(document.createTextNode(k.nom));
      legende.appendChild(item);
    });
    const itemBande = el("span");
    itemBande.appendChild(el("i", "trait bande"));
    itemBande.appendChild(document.createTextNode("Fourchette acceptable"));
    legende.appendChild(itemBande);
    c.appendChild(legende);

    const boite = el("div", "vw-boite");
    c.appendChild(boite);
    const dessiner = function () { boite.replaceChildren(tracerVW(boite.clientWidth, courbes, points, parc, xmax)); };
    setTimeout(dessiner, 0);   // premier tracé, dès que la carte est dans la page
    if (window.ResizeObserver) {
      // redessine quand la largeur change (rotation du téléphone, fenêtre redimensionnée)
      const observateur = new ResizeObserver(function () { dessiner(); });
      observateur.observe(boite);
      observateurs.push(observateur);
    }

    // Les quatre prix clés
    c.appendChild(chiffres(POINTS_VW.map(function (p) {
      const pt = points[p.cle], ic = intervalles[p.cle];
      return {
        etiquette: p.code + " · " + p.nom,
        valeur: pt ? euros(arrondirDemi(pt.x)) : "—",
        libelle: pt ? p.aide : "pas de croisement dans la zone étudiée",
        petit: ic ? "IC 95 % : " + euros(arrondirDemi(ic[0])) + " à " + euros(arrondirDemi(ic[1])) : null,
      };
    }), "points-vw"));
    if (points.pmc && points.pme) {
      c.appendChild(el("p", "prose", "Fourchette de prix acceptable pour " + DU_PARC[parc] + " : de " + euros(arrondirDemi(points.pmc.x)) + " à " + euros(arrondirDemi(points.pme.x)) + "."));
    }

    // Part des répondants pour qui chaque prix testé est suspect, une bonne affaire, cher ou trop cher
    const n = retenus;
    const prix = PRIX_REFERENCE[parc];
    c.appendChild(tableau(
      ["Prix", "Suspect (trop bon marché)", "Bonne affaire", "Cher", "Trop cher"],
      prix.map(function (x) {
        return [euros(x),
          pct((n - borneBasse(tri.tc, x)) / n), pct((n - borneBasse(tri.ba, x)) / n),
          pct(borneHaute(tri.ch, x) / n), pct(borneHaute(tri.tt, x) / n)];
      }),
      "Part des répondants pour qui le billet à ce prix est… (« bonne affaire » inclut les prix plus bas, « cher » et « trop cher » incluent les prix plus hauts)", false));

    // Valeurs des courbes, de 5 € en 5 €
    const lignesTableau = [];
    for (let x = 0; x <= xmax; x += 5) {
      const i = Math.round(x / 0.5);
      lignesTableau.push([euros(x), pct(courbes.tc[i]), pct(courbes.ba[i]), pct(courbes.ch[i]), pct(courbes.tt[i])]);
    }
    c.appendChild(tableau(["Prix", "Trop bon marché", "Bonne affaire", "Cher", "Trop cher"], lignesTableau, "Valeurs des courbes, de 5 € en 5 €", true));
    return c;
  }

  // Dessine les courbes en SVG à la largeur réelle du conteneur (le texte garde ainsi sa taille)
  function tracerVW(largeurConteneur, courbes, points, parc, xmax) {
    const W = Math.max(290, Math.floor(largeurConteneur) || 720), H = 330;
    const m = { g: 46, d: 16, h: 14, b: 36 };
    const pw = W - m.g - m.d, ph = H - m.h - m.b;
    const X = function (v) { return m.g + v / xmax * pw; };
    const Y = function (v) { return m.h + (1 - v) * ph; };

    const resume = POINTS_VW.filter(function (p) { return points[p.cle]; })
      .map(function (p) { return p.nom.toLowerCase() + " " + euros(arrondirDemi(points[p.cle].x)); }).join(", ");
    const svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H, width: W, height: H, "class": "vw", role: "img", tabindex: "0",
      "aria-label": "Courbes de sensibilité au prix pour " + DU_PARC[parc] + (resume ? " : " + resume : "") + ". Flèches gauche et droite pour lire les valeurs.",
    });

    // Quadrillage et axes (traits pleins, discrets)
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      svg.appendChild(svgEl("line", { "class": "grille-h", x1: m.g, x2: m.g + pw, y1: Y(v), y2: Y(v) }));
      const t = svgEl("text", { x: m.g - 8, y: Y(v) + 4, "text-anchor": "end" });
      t.textContent = v * 100 + " %";
      svg.appendChild(t);
    });
    // Une graduation tous les 46 px au plus, pour que les étiquettes ne se chevauchent pas sur téléphone
    const pasGrad = [10, 20, 25, 50, 100].find(function (pas) { return xmax / pas <= pw / 46; }) || 100;
    for (let x = 0; x <= xmax; x += pasGrad) {
      const t = svgEl("text", { x: X(x), y: H - m.b + 18, "text-anchor": "middle" });
      t.textContent = x + " €";
      svg.appendChild(t);
    }
    svg.appendChild(svgEl("line", { "class": "axe", x1: m.g, x2: m.g + pw, y1: Y(0), y2: Y(0) }));

    // Fourchette acceptable
    if (points.pmc && points.pme && points.pme.x > points.pmc.x) {
      svg.appendChild(svgEl("rect", { "class": "bande", x: X(points.pmc.x), y: m.h, width: X(points.pme.x) - X(points.pmc.x), height: ph }));
    }

    // Prix du test A/B : le plus bas s'écrit à gauche de son trait, les autres à droite, pour ne pas se chevaucher
    const reperes = PRIX_REFERENCE[parc].filter(function (p) { return p <= xmax; });
    reperes.forEach(function (p, i) {
      svg.appendChild(svgEl("line", { "class": "ref", x1: X(p), x2: X(p), y1: m.h, y2: m.h + ph }));
      const aGauche = reperes.length > 1 && i === 0;
      const t = svgEl("text", { "class": "halo", x: X(p) + (aGauche ? -4 : 4), y: m.h + 11, "text-anchor": aGauche ? "end" : "start" });
      t.textContent = "A/B " + euros(p);
      svg.appendChild(t);
    });

    // Les quatre courbes
    COURBES.forEach(function (k) {
      const trace = courbes.x.map(function (x, i) { return X(x).toFixed(1) + "," + Y(courbes[k.cle][i]).toFixed(1); }).join(" ");
      const ligne = svgEl("polyline", { "class": "courbe", points: trace });
      ligne.style.stroke = k.couleur;
      if (k.tirets) ligne.style.strokeDasharray = "6 4";
      svg.appendChild(ligne);
    });

    // Les quatre points de croisement, étiquetés directement. Chaque étiquette cherche une place
    // (au-dessus, puis en dessous, puis plus loin) qui ne recouvre ni une autre étiquette ni l'axe.
    const occupe = [];
    POINTS_VW.forEach(function (p) {
      const pt = points[p.cle];
      if (!pt) return;
      const cx = X(pt.x), cy = Y(pt.y);
      svg.appendChild(svgEl("circle", { "class": "pt", cx: cx, cy: cy, r: 5, fill: "var(--fg)" }));
      const libelle = W < 480 ? p.code : p.code + " " + euros(arrondirDemi(pt.x));   // le prix est dans les cartes sous le graphique
      const largeur = libelle.length * 6.8;
      const aDroite = cx + 9 + largeur <= W - 4;
      const gauche = aDroite ? cx + 9 : cx - 9 - largeur;
      let y = cy - 9;
      [-9, 17, -24, 32].some(function (decalage) {
        const essai = cy + decalage;
        const libre = essai - 10 >= m.h && essai + 3 <= Y(0) - 2 && !occupe.some(function (b) {
          return gauche < b.x1 && gauche + largeur > b.x0 && essai - 10 < b.y1 && essai + 3 > b.y0;
        });
        if (libre) y = essai;
        return libre;
      });
      occupe.push({ x0: gauche, x1: gauche + largeur, y0: y - 10, y1: y + 3 });
      const t = svgEl("text", { "class": "pt-nom halo", x: gauche, y: y });
      t.textContent = libelle;
      svg.appendChild(t);
    });

    // Repère de lecture : suit le pointeur (ou les flèches du clavier) et affiche les 4 valeurs
    const viseur = svgEl("line", { "class": "viseur", y1: m.h, y2: m.h + ph });
    viseur.style.display = "none";
    svg.appendChild(viseur);
    const zone = svgEl("rect", { x: m.g, y: m.h, width: pw, height: ph, fill: "transparent" });
    svg.appendChild(zone);

    const lire = function (xVal, ecranX, ecranY) {
      const i = Math.max(0, Math.min(courbes.x.length - 1, Math.round(xVal / 0.5)));
      viseur.setAttribute("x1", X(courbes.x[i]));
      viseur.setAttribute("x2", X(courbes.x[i]));
      viseur.style.display = "";
      montrerBulle("À " + euros(courbes.x[i]), COURBES.map(function (k) {
        return { couleur: k.couleur, tirets: k.tirets, valeur: pct(courbes[k.cle][i]), libelle: k.nom.toLowerCase() };
      }), ecranX, ecranY);
      return courbes.x[i];
    };
    const masquer = function () { viseur.style.display = "none"; cacherBulle(); };
    const survoler = function (e) {
      const r = svg.getBoundingClientRect();
      lire(((e.clientX - r.left) * (W / r.width) - m.g) / pw * xmax, e.clientX, e.clientY);
    };
    zone.addEventListener("pointermove", survoler);
    zone.addEventListener("pointerdown", survoler);
    zone.addEventListener("pointerleave", masquer);

    let curseur = null;
    svg.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const depart = curseur === null ? xmax / 2 : curseur;
      const suivant = Math.max(0, Math.min(xmax, depart + (e.key === "ArrowRight" ? 1 : -1)));
      const r = svg.getBoundingClientRect();
      curseur = lire(suivant, r.left + X(suivant) * (r.width / W), r.top + r.height / 3);
    });
    svg.addEventListener("blur", function () { curseur = null; masquer(); });
    return svg;
  }

  /* --- Critères et budget --- */

  function sectionCriteres(a) {
    const c = carte("Importance de chaque critère", "Note moyenne de 1 (pas important) à 5 (très important), puis part des répondants qui répondent « important » ou « très important ». Les barres partent de 1.");
    const lignes = Object.keys(CRITERES).map(function (colonne) {
      const notes = a.completes.map(function (l) { return num(l[colonne]); }).filter(function (x) { return !isNaN(x); });
      return { nom: CRITERES[colonne], notes: notes, moy: notes.length ? moyenne(notes) : NaN, haut: notes.filter(function (x) { return x >= 4; }).length };
    }).filter(function (l) { return l.notes.length; }).sort(function (x, y) { return y.moy - x.moy; });
    if (!lignes.length) {
      c.appendChild(el("p", "vide", "Pas encore de réponses."));
      return c;
    }
    c.appendChild(barres(lignes.map(function (l) {
      return {
        nom: l.nom, valeur: l.moy - 1, texte: nombre(l.moy, 1) + " · " + pct(l.haut / l.notes.length),
        bulle: [
          { valeur: nombre(l.moy, 2) + " sur 5", libelle: "note moyenne" },
          { valeur: pct(l.haut / l.notes.length, 1), libelle: "« important » ou « très important » (4 ou 5)" },
          { valeur: String(l.notes.length), libelle: "répondants" },
        ],
      };
    }), 4));
    c.appendChild(tableau(["Critère", "Note moyenne", "Part de 4 ou 5", "Répondants"],
      lignes.map(function (l) { return [l.nom, nombre(l.moy, 2), pct(l.haut / l.notes.length, 1), l.notes.length]; }), null, true));
    return c;
  }

  function sectionBudget(a) {
    const frag = document.createDocumentFragment();
    const reglages = lireReglages();
    const brut = a.completes.map(function (l) { return num(l.budget_total); }).filter(function (x) { return !isNaN(x); });
    const extremes = brut.filter(function (x) { return x < BORNES_BUDGET[0] || x > BORNES_BUDGET[1]; });
    const valeurs = reglages.extremes ? brut.filter(function (x) { return x >= BORNES_BUDGET[0] && x <= BORNES_BUDGET[1]; }) : brut;
    if (!valeurs.length) {
      frag.appendChild(el("p", "vide", "Pas encore de réponses."));
      return frag;
    }
    const tries = trier(valeurs);
    frag.appendChild(chiffres([
      { valeur: euros(Math.round(quantile(tries, 0.5))), libelle: "budget médian par personne", petit: "billet, transport et repas", cle: true },
      { valeur: euros(Math.round(moyenne(valeurs))), libelle: "budget moyen" },
      { valeur: euros(Math.round(quantile(tries, 0.25))) + " à " + euros(Math.round(quantile(tries, 0.75))), libelle: "la moitié des répondants (du 1er au 3e quartile)" },
      { valeur: String(valeurs.length), libelle: "réponses prises en compte", petit: extremes.length + " " + pluriel(extremes.length, "montant extrême repéré", "montants extrêmes repérés") + " (hors " + BORNES_BUDGET[0] + " à " + nombre(BORNES_BUDGET[1]) + " €)" },
    ]));
    const tranches = repartir(valeurs, TRANCHES_BUDGET).map(function (t) {
      return { nom: t.haut === Infinity ? "Plus de " + t.bas + " €" : t.bas + " à " + t.haut + " €", n: t.n };
    });
    frag.appendChild(carteCategories("Répartition des budgets", "Par personne, en incluant le billet, le transport et les repas.", tranches, valeurs.length));
    return frag;
  }

  function remplirMethode() {
    const liste = document.getElementById("liste-methode");
    liste.replaceChildren();
    [
      "Source : la Google Sheet du questionnaire, lue à chaque visite et toutes les " + SECONDES_ENTRE_ACTUALISATIONS + " secondes. Le script Google retire les lignes de test et les doublons (même numéro de répondant) avant d'envoyer les données ; il n'envoie pas ce numéro. Aucune donnée personnelle n'est collectée.",
      "Base de l'analyse : les réponses complètes. Les participants de moins de 18 ans, arrêtés au filtre, sont comptés à part.",
      "Seuils de prix : une réponse est « incohérente » si l'un des quatre prix est plus bas que le précédent pour le même parc. Un montant hors de " + BORNES_BILLET[0] + " à " + BORNES_BILLET[1] + " € est « extrême ». Ces réponses sont repérées et comptées ; les deux cases en haut de page permettent de les garder ou de les écarter. Rien n'est jamais effacé de la feuille.",
      "Les intervalles de confiance des quatre prix clés viennent d'un rééchantillonnage de 300 tirages (graine fixe, donc stable d'une actualisation à l'autre) et ne s'affichent qu'à partir de " + MIN_INTERVALLES + " répondants retenus.",
      "Test A/B : on compare la part de répondants qui choisissent Astérix. Intervalle de confiance de chaque part par la méthode de Wilson, de l'écart par la méthode de Newcombe ; test exact de Fisher bilatéral, seuil de 5 %. Un écart non significatif ne prouve pas l'absence d'effet : il peut venir d'un effectif trop faible.",
      "Le coupe-file et le prix sont tirés au sort indépendamment, donc chaque effet se mesure sur toutes les réponses : prix = A + C contre B + D, coupe-file = C + D contre A + B. Cette comparaison n'est fiable que si les versions sont collectées sur la même période.",
      "Budget : les montants hors de " + BORNES_BUDGET[0] + " à " + nombre(BORNES_BUDGET[1]) + " € sont repérés comme extrêmes et écartés si la case correspondante est cochée.",
      "Moins de " + MIN_FIABLE + " réponses : les résultats sont indicatifs. Les courbes ne se tracent qu'à partir de " + MIN_COURBES + " répondants retenus.",
    ].forEach(function (phrase) { liste.appendChild(el("li", null, phrase)); });
  }


  /* ---------- 6. CHARGEMENT ET ACTUALISATION ---------- */

  const zones = {};
  document.querySelectorAll("[data-corps]").forEach(function (z) { zones[z.dataset.corps] = z; });
  const boutonActualiser = document.getElementById("bouton-actualiser");
  const messageGlobal = document.getElementById("message-global");
  const caseIncoherents = document.getElementById("r-incoherents");
  const caseExtremes = document.getElementById("r-extremes");

  let donnees = null;
  let derniereMiseAJour = null;
  let enCours = false;

  function lireReglages() {
    return { incoherents: caseIncoherents.checked, extremes: caseExtremes.checked };
  }

  function afficherEtat(type, message) {
    document.getElementById("pastille-etat").className = "pastille-etat " + type;
    document.getElementById("etat-texte").textContent = message;
  }

  function afficher() {
    observateurs.forEach(function (o) { o.disconnect(); });
    observateurs.length = 0;
    cacherBulle();
    const a = analyser(donnees);
    const sections = {
      echantillon: sectionEchantillon, profil: sectionProfil, habitudes: sectionHabitudes,
      ab: sectionAB, prix: sectionPrix, criteres: sectionCriteres, budget: sectionBudget,
    };
    Object.keys(sections).forEach(function (nom) {
      if (zones[nom]) zones[nom].replaceChildren(sections[nom](a));
    });
    remplirMethode();
    afficherEtat("ok", nombre(a.completes.length) + " " + pluriel(a.completes.length, "réponse complète", "réponses complètes") +
      " · mis à jour à " + heure(derniereMiseAJour));
  }

  function ouvrirMessage(titre, etapes) {
    messageGlobal.replaceChildren(el("strong", null, titre));
    if (etapes) {
      const liste = el("ol");
      etapes.forEach(function (etape) { liste.appendChild(el("li", null, etape)); });
      messageGlobal.appendChild(liste);
    }
    messageGlobal.hidden = false;
  }

  async function charger() {
    if (enCours) return;
    enCours = true;
    boutonActualiser.disabled = true;
    afficherEtat("charge", "Chargement des réponses…");
    Object.keys(zones).forEach(function (n) { zones[n].setAttribute("aria-busy", "true"); });
    const arret = new AbortController();
    const minuteur = setTimeout(function () { arret.abort(); }, 30000);
    try {
      const reponse = await fetch(URL_GOOGLE_SCRIPT + "?action=donnees&t=" + Date.now(), { signal: arret.signal, cache: "no-store" });
      const json = await reponse.json();
      if (!json || json.ok === false) throw new Error((json && json.erreur) || "refusé");
      if (!Array.isArray(json.lignes) || !Array.isArray(json.colonnes)) {
        // L'ancienne version du script Google répond « ça marche » sans envoyer les données
        afficherEtat("erreur", "Le script Google doit être mis à jour.");
        ouvrirMessage("Il reste une étape : mettre à jour le script Google, une seule fois.", [
          "Ouvre la Google Sheet du questionnaire, puis Extensions → Apps Script.",
          "Remplace tout le contenu de Code.gs par celui du fichier questionnaire-ab/apps-script.gs du dépôt, puis enregistre (icône disquette).",
          "Clique sur Déployer → Gérer les déploiements, puis sur le crayon du déploiement existant.",
          "Dans « Version », choisis « Nouvelle version », puis clique sur Déployer. L'adresse reste la même : rien à changer ailleurs.",
          "Reviens ici et clique sur Actualiser.",
        ]);
        return;
      }
      messageGlobal.hidden = true;
      donnees = json;
      derniereMiseAJour = new Date();
      afficher();
      setTimeout(function () { document.body.classList.remove("premier-rendu"); }, 1200);
    } catch (erreur) {
      console.warn("Chargement impossible :", erreur);
      if (donnees) {
        // On garde l'affichage précédent plutôt que de tout effacer
        afficherEtat("erreur", "Actualisation impossible. Données de " + heure(derniereMiseAJour) + " conservées.");
      } else {
        afficherEtat("erreur", "Impossible de lire les réponses.");
        ouvrirMessage("Les réponses n'ont pas pu être chargées.", [
          "Vérifie ta connexion internet, puis clique sur Actualiser.",
          "Si le problème continue, vérifie que le script Google est bien publié : « Qui a accès » doit être « Tout le monde ».",
        ]);
      }
    } finally {
      clearTimeout(minuteur);
      enCours = false;
      boutonActualiser.disabled = false;
      Object.keys(zones).forEach(function (n) { zones[n].removeAttribute("aria-busy"); });
    }
  }

  document.body.classList.add("premier-rendu");
  remplirMethode();
  boutonActualiser.addEventListener("click", charger);
  [caseIncoherents, caseExtremes].forEach(function (c) {
    c.addEventListener("change", function () { if (donnees) afficher(); });
  });

  // Actualisation automatique, seulement quand la page est visible
  setInterval(function () {
    if (document.visibilityState === "visible") charger();
  }, SECONDES_ENTRE_ACTUALISATIONS * 1000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && derniereMiseAJour &&
        Date.now() - derniereMiseAJour.getTime() > SECONDES_ENTRE_ACTUALISATIONS * 1000) charger();
  });

  charger();
})();

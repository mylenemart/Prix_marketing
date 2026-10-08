/* ==========================================================================
   script.js — fonctionnement du questionnaire
   - affiche un écran à la fois et fait avancer la barre de progression ;
   - vérifie que chaque question a une réponse ;
   - tire au sort la version A ou B ;
   - envoie les réponses (une ligne par répondant) vers la Google Sheet.
   ========================================================================== */


/* ---------- 1. RÉGLAGES : c'est ici que tu modifies les valeurs ---------- */

// Adresse de ton script Google Apps Script (voir README.md, étape 3).
// Colle-la entre les guillemets. Elle se termine par /exec.
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbz2aQpeyu-K0h4307N1GE1sAkMTHErWHYc06_2cjfCWjz9jjn-4lhA8hHVXr_CSve_j/exec";

// TEST A/B : prix affichés dans la question « quel parc choisiriez-vous ? ».
// Seul le prix du Parc Astérix change entre les deux versions.
const VERSIONS = {
  A: { asterix: 55, disney: 55 },
  B: { asterix: 65, disney: 55 },
};

// Ordre des colonnes dans la Google Sheet (une ligne par répondant).
// Si tu ajoutes une question dans index.html, ajoute son nom ici :
// la colonne apparaîtra toute seule dans la feuille.
const COLONNES = [
  "horodatage", "id_aleatoire", "version", "statut", "test",
  "prix_asterix_ab", "prix_disney_ab",
  "filtre_18ans",
  "age", "situation_familiale", "situation", "residence",
  "frequence", "occasions", "parcs_visites", "achat_billet",
  "choix_ab", "critere_1", "critere_2", "critere_3",
  "vw_trop_bon_marche_asterix", "vw_bonne_affaire_asterix", "vw_cher_asterix", "vw_trop_cher_asterix",
  "vw_trop_bon_marche_disney", "vw_bonne_affaire_disney", "vw_cher_disney", "vw_trop_cher_disney",
  "controle", "accompagnement", "budget_total",
  "incoherent_vw_asterix", "incoherent_vw_disney",
];

// Les 4 questions Van Westendorp de chaque parc, dans l'ordre où elles sont posées.
const QUESTIONS_VW = {
  asterix: ["vw_trop_bon_marche_asterix", "vw_bonne_affaire_asterix", "vw_cher_asterix", "vw_trop_cher_asterix"],
  disney:  ["vw_trop_bon_marche_disney", "vw_bonne_affaire_disney", "vw_cher_disney", "vw_trop_cher_disney"],
};
const NOMS_PARCS = { asterix: "le Parc Astérix", disney: "Disneyland Paris" };


/* ---------- 2. TIRAGE AU SORT ET MODE TEST ---------- */

// Paramètres à ajouter à la fin de l'adresse, pour tes essais :
//   ?test=1       → les réponses sont marquées comme tests (colonne test = oui)
//   ?version=A    → force la version A (ou ?version=B pour la B)
//   on peut combiner les deux : ?test=1&version=B
const parametres = new URLSearchParams(window.location.search);
const modeTest = parametres.get("test") === "1";
const versionForcee = (parametres.get("version") || "").toUpperCase();

const version = choisirVersion();
const idAleatoire = choisirIdentifiant();

// Tirage au sort 50/50 à l'ouverture du questionnaire.
// La version est gardée dans sessionStorage (la mémoire de l'onglet) :
// si la personne recharge la page, elle garde la même version.
function choisirVersion() {
  const dejaTiree = lireMemoire("version");
  let choix;
  if (versionForcee === "A" || versionForcee === "B") {
    choix = versionForcee;                      // version imposée pour un essai
  } else if (dejaTiree === "A" || dejaTiree === "B") {
    choix = dejaTiree;                          // déjà tirée dans cet onglet
  } else {
    choix = Math.random() < 0.5 ? "A" : "B";    // tirage au sort : une chance sur deux
  }
  ecrireMemoire("version", choix);
  return choix;
}

// Numéro tiré au hasard qui distingue les répondants sans rien dire sur eux.
// Il est gardé avec la version : si la page est rechargée, le numéro reste le même,
// ce qui permet de repérer d'éventuels doublons dans la Google Sheet.
function choisirIdentifiant() {
  let id = lireMemoire("id_aleatoire");
  if (!id) {
    id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    ecrireMemoire("id_aleatoire", id);
  }
  return id;
}

// sessionStorage peut être bloqué (certains modes de navigation privée) :
// dans ce cas, le questionnaire fonctionne quand même.
function lireMemoire(cle) {
  try { return sessionStorage.getItem(cle); } catch (erreur) { return null; }
}
function ecrireMemoire(cle, valeur) {
  try { sessionStorage.setItem(cle, valeur); } catch (erreur) { /* on continue sans mémoire */ }
}


/* ---------- 3. MISE EN PLACE DE LA PAGE ---------- */

const formulaire = document.getElementById("questionnaire");
const boutonSuivant = document.getElementById("bouton-suivant");
const messageErreur = document.getElementById("message-erreur");
const messageVerification = document.getElementById("message-verification");
const barreProgression = document.getElementById("progression");
const remplissage = document.getElementById("progression-remplissage");
const etatEnvoi = document.getElementById("etat-envoi");
const boutonReessayer = document.getElementById("bouton-reessayer");

appliquerVersion(version);
afficherBandeauTest();

// Liste des écrans de questions, dans l'ordre (sans les écrans de fin)
const ecrans = Array.from(document.querySelectorAll(".ecran:not(.ecran-fin)"));
let numeroEcran = 0;
const reponses = {};            // les réponses de la personne, rangées par nom de question
const classements = {};         // l'ordre dans lequel les critères ont été touchés
let verificationAffichee = false;

// Si la personne a déjà terminé dans cet onglet (page rechargée), on n'envoie pas
// ses réponses une deuxième fois : on lui remontre simplement le remerciement.
// (En mode test, on peut recommencer autant de fois qu'on veut.)
const dejaTermine = modeTest ? null : lireMemoire("termine");
if (dejaTermine) {
  afficherFin(dejaTermine);
  afficherMessage(etatEnvoi, "Vos réponses ont bien été enregistrées.");
} else {
  afficherEcran(0, false);
}

// Le bouton (ou la touche Entrée) fait passer à l'écran suivant
formulaire.addEventListener("submit", function (evenement) {
  evenement.preventDefault();
  passerALaSuite();
});

// Dès que la personne modifie sa réponse, on efface les messages
formulaire.addEventListener("input", cacherMessages);
formulaire.addEventListener("change", function (evenement) {
  cacherMessages();
  const caseCochee = evenement.target;
  if (caseCochee.type !== "checkbox") return;
  if (caseCochee.closest("[data-classement]")) {
    mettreAJourClassement(caseCochee);
  } else if (caseCochee.checked) {
    decocherReponsesIncompatibles(caseCochee);
  }
});


/* ---------- 4. NAVIGATION ---------- */

function passerALaSuite() {
  const ecran = ecrans[numeroEcran];
  const resultat = lireReponses(ecran);

  // Réponse obligatoire : on reste sur l'écran avec un message
  if (resultat.erreur) {
    afficherMessage(messageErreur, resultat.erreur);
    return;
  }
  Object.assign(reponses, resultat.valeurs);

  // Van Westendorp : si un prix est plus bas que la réponse précédente (même parc),
  // on invite poliment à vérifier. Un 2e clic sur le bouton permet de continuer.
  const alertes = verifierOrdreDesPrix(ecran);
  if (alertes.length > 0 && !verificationAffichee) {
    verificationAffichee = true;
    afficherMessage(messageVerification,
      "Petite vérification : " + alertes.join(" ; ") + ". Vous pouvez corriger, " +
      "ou cliquer à nouveau sur « Suivant » pour garder vos réponses.");
    return;
  }

  // Filtre : une réponse « Non » arrête le questionnaire
  if (ecran.hasAttribute("data-filtre") && Object.values(resultat.valeurs)[0] === "non") {
    terminer("filtré");
    return;
  }

  const suivant = numeroEcranSuivant(numeroEcran);
  if (suivant === null) {
    terminer("complet");      // c'était la dernière question
    return;
  }
  numeroEcran = suivant;
  afficherEcran(numeroEcran, true);
}

// Trouve le prochain écran à afficher, en sautant ceux qui ne concernent pas la personne
// (data-sauter-si="question=réponse").
function numeroEcranSuivant(numero) {
  for (let i = numero + 1; i < ecrans.length; i++) {
    const condition = ecrans[i].dataset.sauterSi;
    if (condition) {
      const [nom, valeur] = condition.split("=");
      if (reponses[nom] === valeur) {
        effacerReponsesDe(ecrans[i]);
        continue;
      }
    }
    return i;
  }
  return null;
}

function afficherEcran(numero, deplacerFocus) {
  const ecran = ecrans[numero];
  cacherTousLesEcrans();
  ecran.classList.add("actif");
  boutonSuivant.textContent = ecran.dataset.bouton || "Suivant";
  verificationAffichee = false;
  cacherMessages();
  mettreAJourProgression(numero / ecrans.length);
  if (deplacerFocus) {
    placerLeFocus(ecran);
  }
}

function terminer(statut) {
  const ligne = preparerLigne(statut);
  afficherFin(statut);
  envoyer(ligne, statut);
}

function afficherFin(statut) {
  cacherTousLesEcrans();
  const ecranFin = document.getElementById(statut === "complet" ? "fin-complet" : "fin-filtre");
  ecranFin.classList.add("actif");
  boutonSuivant.hidden = true;
  cacherMessages();
  mettreAJourProgression(1);
  placerLeFocus(ecranFin);
}


/* ---------- 5. ENVOI DES RÉPONSES VERS LA GOOGLE SHEET ---------- */

async function envoyer(ligne, statut) {
  boutonReessayer.hidden = true;

  if (!URL_GOOGLE_SCRIPT) {
    // Pas encore d'adresse : rien n'est enregistré (pratique pour tester la page seule)
    console.warn("URL_GOOGLE_SCRIPT est vide : réponses non enregistrées.", ligne);
    if (modeTest) afficherMessage(etatEnvoi, "Mode test : adresse Google Sheet absente, rien n'a été enregistré.");
    return;
  }

  afficherMessage(etatEnvoi, "Enregistrement de vos réponses…");

  // Jusqu'à 3 essais, au cas où la connexion serait mauvaise
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch(URL_GOOGLE_SCRIPT, {
        method: "POST",
        // Envoyé comme du texte simple : c'est ce que Google Apps Script accepte
        // depuis un autre site sans blocage du navigateur.
        body: JSON.stringify(ligne),
      });
      const resultat = await reponse.json();
      if (!resultat.ok) throw new Error(resultat.erreur || "refusé");
      // Une ancienne version du script Google répondrait « ok » sans tout enregistrer
      if (!resultat.colonnes) throw new Error("script Google pas à jour : recolle apps-script.gs et redéploie");

      ecrireMemoire("termine", statut);
      afficherMessage(etatEnvoi, "Vos réponses ont bien été enregistrées. Merci !");
      return;
    } catch (erreur) {
      console.warn("Envoi impossible (essai " + essai + ") :", erreur);
      await attendre(1500 * essai);
    }
  }

  afficherMessage(etatEnvoi,
    "Vos réponses n'ont pas pu être envoyées. Vérifiez votre connexion internet, puis réessayez.");
  boutonReessayer.hidden = false;
  boutonReessayer.onclick = function () { envoyer(ligne, statut); };
}

function attendre(millisecondes) {
  return new Promise(function (fin) { setTimeout(fin, millisecondes); });
}


/* ---------- 6. LECTURE ET VÉRIFICATION DES RÉPONSES ---------- */

// Renvoie { valeurs: { nom: valeur, … } } si l'écran est bien rempli, ou { erreur } sinon.
function lireReponses(ecran) {
  const valeurs = {};

  // Classement des critères
  if (ecran.dataset.classement) {
    const prefixe = ecran.dataset.classement;
    const attendu = Number(ecran.dataset.nombreChoix);
    const ordre = classements[prefixe] || [];
    if (ordre.length < attendu) {
      return { erreur: "Choisissez " + attendu + " critères, du plus important au moins important." };
    }
    ordre.forEach(function (valeur, i) { valeurs[prefixe + "_" + (i + 1)] = valeur; });
    return { valeurs: valeurs };
  }

  // Case « J'accepte de participer »
  const accord = ecran.querySelector('input[name="accord"]');
  if (accord) {
    return accord.checked
      ? { valeurs: valeurs }
      : { erreur: "Cochez la case « J'accepte de participer » pour commencer." };
  }

  // Une seule réponse (boutons ronds)
  for (const nom of nomsDesChamps(ecran, 'input[type="radio"]')) {
    const coche = ecran.querySelector('input[name="' + nom + '"]:checked');
    if (!coche) return { erreur: "Choisissez une réponse pour continuer." };
    valeurs[nom] = coche.value;
  }

  // Plusieurs réponses possibles (cases carrées) : enregistrées ensemble, séparées par « | »
  for (const nom of nomsDesChamps(ecran, 'input[type="checkbox"]')) {
    const cochees = Array.from(ecran.querySelectorAll('input[name="' + nom + '"]:checked'));
    if (cochees.length === 0) return { erreur: "Choisissez au moins une réponse pour continuer." };
    valeurs[nom] = cochees.map(function (c) { return c.value; }).join(" | ");
  }

  // Champs chiffrés (montants en euros, âge)
  const champs = Array.from(ecran.querySelectorAll('input[type="text"]'));
  for (const champ of champs) {
    if (champ.dataset.nombre === "entier") {
      const min = Number(champ.dataset.min), max = Number(champ.dataset.max);
      const nombre = lireEntier(champ.value);
      if (nombre === null || nombre < min || nombre > max) {
        return { erreur: "Indiquez votre âge en chiffres (entre " + min + " et " + max + " ans)." };
      }
      valeurs[champ.name] = nombre;
    } else {
      const montant = lireMontant(champ.value);
      if (montant === null) {
        return { erreur: champs.length > 1
          ? "Indiquez un montant en euros pour chaque parc, en chiffres."
          : "Indiquez un montant en euros, en chiffres." };
      }
      valeurs[champ.name] = montant;
    }
  }

  return { valeurs: valeurs };
}

// Les différents noms de questions présents sur un écran, pour un type de champ
function nomsDesChamps(ecran, selecteur) {
  const noms = Array.from(ecran.querySelectorAll(selecteur)).map(function (c) { return c.name; });
  return Array.from(new Set(noms)).filter(Boolean);
}

// Transforme « 45 », « 45,50 », « 45.5 € » ou « 1 000 » en nombre.
// Renvoie null si ce n'est pas un montant valable.
function lireMontant(texte) {
  const nettoye = texte.replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(nettoye)) {
    return null;
  }
  return Number(nettoye);
}

function lireEntier(texte) {
  const nettoye = texte.replace(/\s/g, "");
  return /^\d+$/.test(nettoye) ? Number(nettoye) : null;
}

// Liste les prix plus bas que la réponse précédente du même parc (Van Westendorp)
function verifierOrdreDesPrix(ecran) {
  const alertes = [];
  ecran.querySelectorAll("input[data-precedent]").forEach(function (champ) {
    const precedent = reponses[champ.dataset.precedent];
    if (reponses[champ.name] < precedent) {
      const parc = champ.name.endsWith("_asterix") ? NOMS_PARCS.asterix : NOMS_PARCS.disney;
      alertes.push("pour " + parc + ", ce montant est plus bas que votre réponse précédente (" + formaterEuros(precedent) + ")");
    }
  });
  return alertes;
}


/* ---------- 7. PRÉPARATION DE LA LIGNE DE RÉSULTATS ---------- */

function preparerLigne(statut) {
  const ligne = Object.assign({
    id_aleatoire: idAleatoire,
    version: version,
    statut: statut,
    test: modeTest ? "oui" : "non",
    prix_asterix_ab: VERSIONS[version].asterix,
    prix_disney_ab: VERSIONS[version].disney,
  }, reponses);
  if (statut === "complet") {
    ligne.incoherent_vw_asterix = vanWestendorpIncoherent(QUESTIONS_VW.asterix) ? "oui" : "non";
    ligne.incoherent_vw_disney = vanWestendorpIncoherent(QUESTIONS_VW.disney) ? "oui" : "non";
  }
  // Liste des colonnes, pour que le script Google les range dans le bon ordre
  ligne._colonnes = COLONNES;
  return ligne;
}

// Incohérent si une réponse est plus basse que la précédente (pour un même parc)
function vanWestendorpIncoherent(questions) {
  for (let i = 1; i < questions.length; i++) {
    if (reponses[questions[i]] < reponses[questions[i - 1]]) {
      return true;
    }
  }
  return false;
}


/* ---------- 8. PETITS OUTILS ---------- */

// Écrit les prix du test A/B dans la question de choix entre les parcs
function appliquerVersion(laVersion) {
  const prix = VERSIONS[laVersion];
  document.querySelectorAll("[data-prix-asterix]").forEach(function (element) {
    element.textContent = formaterEuros(prix.asterix);
  });
  document.querySelectorAll("[data-prix-disney]").forEach(function (element) {
    element.textContent = formaterEuros(prix.disney);
  });
}

// « Aucun des deux » décoche les autres réponses, et inversement
function decocherReponsesIncompatibles(caseCochee) {
  const groupe = formulaire.querySelectorAll('input[name="' + caseCochee.name + '"]');
  groupe.forEach(function (autre) {
    if (autre !== caseCochee &&
        (caseCochee.hasAttribute("data-exclusive") || autre.hasAttribute("data-exclusive"))) {
      autre.checked = false;
    }
  });
}

// Classement : retient l'ordre dans lequel les critères sont touchés (3 au maximum)
function mettreAJourClassement(caseTouchee) {
  const ecran = caseTouchee.closest("[data-classement]");
  const prefixe = ecran.dataset.classement;
  const maximum = Number(ecran.dataset.nombreChoix);
  const ordre = classements[prefixe] || (classements[prefixe] = []);

  if (caseTouchee.checked) {
    if (ordre.length >= maximum) {
      caseTouchee.checked = false;
      afficherMessage(messageErreur,
        "Vous avez déjà choisi " + maximum + " critères. Touchez un critère choisi pour l'enlever.");
      return;
    }
    ordre.push(caseTouchee.value);
  } else {
    ordre.splice(ordre.indexOf(caseTouchee.value), 1);
  }

  ecran.querySelectorAll(".option-classement").forEach(function (option) {
    const valeur = option.querySelector("input").value;
    const rang = ordre.indexOf(valeur);
    option.querySelector(".rang").textContent = rang === -1 ? "" : (rang === 0 ? "1er" : (rang + 1) + "e");
  });
}

function effacerReponsesDe(ecran) {
  ecran.querySelectorAll("input").forEach(function (champ) {
    delete reponses[champ.name];
  });
}

// Bandeau visible seulement pendant tes essais (jamais pour les vrais participants)
function afficherBandeauTest() {
  const morceaux = [];
  if (modeTest) morceaux.push("Mode test");
  if (versionForcee === "A" || versionForcee === "B") morceaux.push("Version " + version + " forcée");
  if (morceaux.length > 0) {
    const bandeau = document.getElementById("bandeau-test");
    bandeau.textContent = morceaux.join(" · ");
    bandeau.hidden = false;
  }
}

function cacherTousLesEcrans() {
  document.querySelectorAll(".ecran.actif").forEach(function (ecran) {
    ecran.classList.remove("actif");
  });
}

function mettreAJourProgression(part) {
  const pourcentage = Math.round(part * 100);
  remplissage.style.width = pourcentage + "%";
  barreProgression.setAttribute("aria-valuenow", pourcentage);
}

function afficherMessage(element, texte) {
  element.textContent = texte;
  element.hidden = false;
}

function cacherMessages() {
  messageErreur.hidden = true;
  messageVerification.hidden = true;
}

function placerLeFocus(ecran) {
  window.scrollTo(0, 0);
  const titre = ecran.querySelector("h1");
  if (titre) {
    titre.focus({ preventScroll: true });
  }
}

function formaterEuros(montant) {
  return montant.toLocaleString("fr-FR") + " €";
}

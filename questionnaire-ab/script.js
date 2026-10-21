/* ==========================================================================
   script.js — fonctionnement du questionnaire
   - affiche un écran à la fois et fait avancer la barre de progression ;
   - vérifie que chaque question a une réponse ;
   - tire au sort la version A, B, C ou D ;
   - envoie les réponses (une ligne par répondant) vers la Google Sheet.
   ========================================================================== */


/* ---------- 1. RÉGLAGES : c'est ici que tu modifies les valeurs ---------- */

// Adresse de ton script Google Apps Script (voir README.md, étape 3).
// Colle-la entre les guillemets. Elle se termine par /exec.
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwtrnfIMmf2FBcTQQjy87iXsiss4yNRIe2K-cdjKLz340ftiXWvxKqwvOM4kLkDij8U/exec";

// TEST A/B (2 facteurs croisés) : offres affichées dans la question « quel parc choisiriez-vous ? ».
// Disneyland est toujours à 79 €. Deux facteurs, chacun tiré au sort indépendamment :
//   - le prix du Parc Astérix : 49 € ou 54,50 € ;
//   - un coupe-file utilisable une seule fois dans la journée : oui ou non.
// Quatre versions, une chance sur quatre chacune :
//   A : Astérix 49 €, sans coupe-file        B : Astérix 54,50 €, sans coupe-file
//   C : Astérix 49 € + coupe-file            D : Astérix 54,50 € + coupe-file
// Effet du prix = comparer A+C contre B+D ; effet du coupe-file = comparer A+B contre C+D.
// Le bonus ne concerne que le Parc Astérix ; laisse bonus vide ("") pour une offre sans cadeau.
const COUPE_FILE = "un coupe-file utilisable une seule fois dans la journée";
const VERSIONS = {
  A: { asterix: 49, disney: 79, bonus: "" },
  B: { asterix: 54.5, disney: 79, bonus: "" },
  C: { asterix: 49, disney: 79, bonus: COUPE_FILE },
  D: { asterix: 54.5, disney: 79, bonus: COUPE_FILE },
};
const VERSIONS_VALIDES = ["A", "B", "C", "D"];

// Ordre des colonnes dans la Google Sheet (une ligne par répondant).
// Si tu ajoutes une question dans index.html, ajoute son nom ici :
// la colonne apparaîtra toute seule dans la feuille.
const COLONNES = [
  "horodatage", "id_aleatoire", "version", "statut", "test", "langue",
  "prix_asterix_ab", "prix_disney_ab", "bonus_asterix_ab",
  "age", "situation_familiale", "situation",
  "residence", "frequence", "occasions",
  "visite_asterix", "visite_disney", "achat_billet", "affluence_asterix", "affluence_disney",
  "choix_ab",
  "importance_prix", "importance_attractions", "importance_univers", "importance_spectacles",
  "importance_enfants", "importance_attente", "importance_acces",
  "accompagnement",
  "vw_trop_bon_marche_asterix", "vw_bonne_affaire_asterix", "vw_cher_asterix", "vw_trop_cher_asterix",
  "vw_trop_bon_marche_disney", "vw_bonne_affaire_disney", "vw_cher_disney", "vw_trop_cher_disney",
  "budget_total",
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
//   ?version=A    → force la version A (ou B, C, D)
//   on peut combiner les deux : ?test=1&version=C
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
  if (VERSIONS_VALIDES.includes(versionForcee)) {
    choix = versionForcee;                      // version imposée pour un essai
  } else if (VERSIONS_VALIDES.includes(dejaTiree)) {
    choix = dejaTiree;                          // déjà tirée dans cet onglet
  } else {
    choix = VERSIONS_VALIDES[Math.floor(Math.random() * VERSIONS_VALIDES.length)];  // une chance sur quatre
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
const compteur = document.getElementById("compteur");

traduireLaPage();          // version anglaise si l'appareil n'est pas en français (voir traduction.js)
appliquerVersion(version);
afficherBandeauTest();

// Liste des écrans de questions, dans l'ordre (sans les écrans de fin)
const ecrans = Array.from(document.querySelectorAll(".ecran:not(.ecran-fin)"));

// Les parties du questionnaire, dans l'ordre (ex. Vous, Vos habitudes, Vos choix…),
// lues dans les textes <p class="partie"> : sert au compteur « Partie 2 sur 4 ».
const parties = [];
ecrans.forEach(function (ecran) {
  const libelle = ecran.querySelector(".partie");
  if (libelle && !parties.includes(libelle.textContent)) parties.push(libelle.textContent);
});

let numeroEcran = 0;
const reponses = {};            // les réponses de la personne, rangées par nom de question
let verificationAffichee = false;

// Si la personne a déjà terminé dans cet onglet (page rechargée), on n'envoie pas
// ses réponses une deuxième fois : on lui remontre simplement le remerciement.
// (En mode test, on peut recommencer autant de fois qu'on veut.)
const dejaTermine = modeTest ? null : lireMemoire("termine");
if (dejaTermine) {
  afficherFin(dejaTermine);
  afficherMessage(etatEnvoi, t("Vos réponses ont bien été enregistrées.", "Your answers have been saved."));
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
  caseCochee.closest(".question")?.classList.remove("manquante");
  if (caseCochee.type === "checkbox" && caseCochee.checked) {
    decocherReponsesIncompatibles(caseCochee);
  }
  mettreAJourQuestionsMasquees();
});


/* ---------- 4. NAVIGATION ---------- */

function passerALaSuite() {
  const ecran = ecrans[numeroEcran];
  const resultat = lireReponses(ecran);

  // Réponse obligatoire : on reste sur l'écran avec un message
  if (resultat.erreur) {
    afficherMessage(messageErreur, resultat.erreur);
    if (resultat.question) {
      // on montre la question oubliée
      resultat.question.classList.add("manquante");
      resultat.question.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }
  Object.assign(reponses, resultat.valeurs);

  // Van Westendorp : si un prix est plus bas que la réponse précédente (même parc),
  // on invite poliment à vérifier. Un 2e clic sur le bouton permet de continuer.
  const alertes = verifierOrdreDesPrix(ecran);
  if (alertes.length > 0 && !verificationAffichee) {
    verificationAffichee = true;
    afficherMessage(messageVerification,
      t("Petite vérification : " + alertes.join(" ; ") + ". Vous pouvez corriger, " +
        "ou cliquer à nouveau sur « Suivant » pour garder vos réponses.",
        "Quick check: " + alertes.join("; ") + ". You can correct it, " +
        "or click “Next” again to keep your answers."));
    return;
  }

  // Filtre : moins de 18 ans arrête le questionnaire
  if (ecran.hasAttribute("data-filtre") && resultat.valeurs.age < 18) {
    terminer("filtré");
    return;
  }

  if (numeroEcran === ecrans.length - 1) {
    terminer("complet");      // c'était la dernière page
    return;
  }
  numeroEcran = numeroEcran + 1;
  afficherEcran(numeroEcran, true);
}

// Masque les questions qui ne concernent pas la personne, d'après une réponse
// de la même page (data-masquer-si="question=réponse"). Une question masquée
// est vidée et n'est pas obligatoire.
function mettreAJourQuestionsMasquees() {
  document.querySelectorAll("[data-masquer-si]").forEach(function (question) {
    const [nom, valeur] = question.dataset.masquerSi.split("=");
    const coche = formulaire.querySelector('input[name="' + nom + '"]:checked');
    const masquer = Boolean(coche && coche.value === valeur);
    question.hidden = masquer;
    question.querySelectorAll("input").forEach(function (champ) {
      champ.disabled = masquer;
      if (masquer) champ.checked = false;
    });
  });
}

function afficherEcran(numero, deplacerFocus) {
  const ecran = ecrans[numero];
  cacherTousLesEcrans();
  ecran.classList.add("actif");
  boutonSuivant.textContent = ecran.dataset.bouton || t("Suivant", "Next");
  verificationAffichee = false;
  cacherMessages();
  mettreAJourProgression(numero / ecrans.length);
  mettreAJourCompteur(ecran);
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
  compteur.hidden = true;
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

  afficherMessage(etatEnvoi, t("Enregistrement de vos réponses…", "Saving your answers…"));

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
      afficherMessage(etatEnvoi, t("Vos réponses ont bien été enregistrées. Merci !", "Your answers have been saved. Thank you!"));
      return;
    } catch (erreur) {
      console.warn("Envoi impossible (essai " + essai + ") :", erreur);
      await attendre(1500 * essai);
    }
  }

  afficherMessage(etatEnvoi,
    t("Vos réponses n'ont pas pu être envoyées. Vérifiez votre connexion internet, puis réessayez.",
      "Your answers could not be sent. Check your internet connection, then try again."));
  boutonReessayer.hidden = false;
  boutonReessayer.onclick = function () { envoyer(ligne, statut); };
}

function attendre(millisecondes) {
  return new Promise(function (fin) { setTimeout(fin, millisecondes); });
}


/* ---------- 6. LECTURE ET VÉRIFICATION DES RÉPONSES ---------- */

// Renvoie { valeurs: { nom: valeur, … } } si la page est bien remplie,
// ou { erreur, question } sinon (question = le bloc à compléter).
function lireReponses(ecran) {
  const valeurs = {};

  // Case « J'accepte de participer »
  const accord = ecran.querySelector('input[name="accord"]');
  if (accord) {
    return accord.checked
      ? { valeurs: valeurs }
      : { erreur: t("Cochez la case « J'accepte de participer » pour commencer.", "Tick “I agree to take part” to start.") };
  }

  // Les questions sont lues dans l'ordre de la page : on s'arrête à la première oubliée
  const questions = Array.from(ecran.querySelectorAll(".question")).filter(function (q) { return !q.hidden; });
  for (const question of questions) {
    const erreur = lireQuestion(question, valeurs);
    if (erreur) return { erreur: erreur, question: question };
  }
  return { valeurs: valeurs };
}

// Lit une question (ou une matrice) et range ses réponses dans valeurs.
// Renvoie un message d'erreur si elle n'est pas remplie.
function lireQuestion(question, valeurs) {
  // Une seule réponse (boutons ronds) ; pour une matrice, une par ligne
  for (const nom of nomsDesChamps(question, 'input[type="radio"]')) {
    const coche = question.querySelector('input[name="' + nom + '"]:checked');
    if (!coche) {
      return question.classList.contains("matrice")
        ? t("Choisissez une réponse pour chaque ligne du tableau.", "Choose an answer for each row of the table.")
        : t("Répondez à chaque question pour continuer.", "Please answer every question to continue.");
    }
    // une note (1 à 5) est enregistrée comme un nombre
    valeurs[nom] = /^\d+$/.test(coche.value) ? Number(coche.value) : coche.value;
  }

  // Plusieurs réponses possibles (cases carrées) : enregistrées ensemble, séparées par « | »
  for (const nom of nomsDesChamps(question, 'input[type="checkbox"]')) {
    const cochees = Array.from(question.querySelectorAll('input[name="' + nom + '"]:checked'));
    if (cochees.length === 0 && question.dataset.facultatif) {
      valeurs[nom] = question.dataset.facultatif;   // rien coché : réponse par défaut (ex. « Aucun »)
      continue;
    }
    if (cochees.length === 0) return t("Choisissez au moins une réponse à chaque question.", "Choose at least one answer for each question.");
    valeurs[nom] = cochees.map(function (c) { return c.value; }).join(" | ");
  }

  // Champs chiffrés (montants en euros, âge)
  const champs = Array.from(question.querySelectorAll('input[type="text"]:not(:disabled)'));
  for (const champ of champs) {
    if (champ.dataset.nombre === "entier") {
      const min = Number(champ.dataset.min), max = Number(champ.dataset.max);
      const nombre = lireEntier(champ.value);
      if (nombre === null || nombre < min || nombre > max) {
        return t("Indiquez votre âge en chiffres (entre " + min + " et " + max + " ans).",
          "Enter your age in numbers (between " + min + " and " + max + ").");
      }
      valeurs[champ.name] = nombre;
    } else {
      const montant = lireMontant(champ.value);
      if (montant === null) {
        return champs.length > 1
          ? t("Indiquez un montant en euros pour chaque parc, en chiffres.", "Enter an amount in euros for each park, in numbers.")
          : t("Indiquez un montant en euros, en chiffres.", "Enter an amount in euros, in numbers.");
      }
      valeurs[champ.name] = montant;
    }
  }
  return null;
}

// Les différents noms de questions présents sur un écran, pour un type de champ
function nomsDesChamps(ecran, selecteur) {
  const noms = Array.from(ecran.querySelectorAll(selecteur))
    .filter(function (c) { return !c.disabled; })
    .map(function (c) { return c.name; });
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
      alertes.push(t("pour " + parc + ", ce montant est plus bas que votre réponse précédente (" + formaterEuros(precedent) + ")",
        "for " + parc.replace(/^le /, "") + ", this amount is lower than your previous answer (" + formaterEuros(precedent) + ")"));
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
    langue: LANGUE,
    prix_asterix_ab: VERSIONS[version].asterix,
    prix_disney_ab: VERSIONS[version].disney,
    bonus_asterix_ab: VERSIONS[version].bonus,
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
    if (prix.bonus) {
      const bonus = document.createElement("span");
      bonus.className = "bonus";
      bonus.textContent = "+ " + traduireTexte(prix.bonus);
      element.parentElement.appendChild(bonus);   // sur sa propre ligne, sous le nom et le prix
    }
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

// Bandeau visible seulement pendant tes essais (jamais pour les vrais participants)
function afficherBandeauTest() {
  const morceaux = [];
  if (modeTest) morceaux.push("Mode test");
  if (VERSIONS_VALIDES.includes(versionForcee)) morceaux.push("Version " + version + " forcée");
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

// Affiche la partie en cours : « Partie 2 sur 4 · Vos habitudes ».
// Caché sur l'accueil, le filtre et les écrans de fin (pas de partie).
function mettreAJourCompteur(ecran) {
  const libelle = ecran.querySelector(".partie");
  if (!libelle) {
    compteur.hidden = true;
    return;
  }
  const rang = parties.indexOf(libelle.textContent) + 1;
  compteur.textContent = t("Partie ", "Part ") + rang + t(" sur ", " of ") + parties.length +
    " · " + libelle.textContent;
  compteur.hidden = false;
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
  const titre = ecran.querySelector("h1, h2");
  if (titre) {
    titre.focus({ preventScroll: true });
  }
}

function formaterEuros(montant) {
  // 49 → « 49 € » ; 54,5 → « 54,50 € » (deux décimales seulement quand il en faut)
  const options = Number.isInteger(montant) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return montant.toLocaleString("fr-FR", options) + " €";
}

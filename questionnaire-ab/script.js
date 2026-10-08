/* ==========================================================================
   script.js — fonctionnement du questionnaire
   - affiche un écran à la fois et fait avancer la barre de progression ;
   - vérifie que chaque question a une réponse ;
   - rassemble les réponses de la personne (une ligne par répondant).
   ========================================================================== */


/* ---------- 1. RÉGLAGES : c'est ici que tu modifies les valeurs ---------- */

// Adresse de ton script Google Apps Script (voir README.md, étape 3).
// Colle-la entre les guillemets. Elle se termine par /exec.
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbz2aQpeyu-K0h4307N1GE1sAkMTHErWHYc06_2cjfCWjz9jjn-4lhA8hHVXr_CSve_j/exec";

// Les deux versions de l'offre. Seuls le nom et la couleur du parc changent.
const VERSIONS = {
  A: { parc: "Disneyland Paris", couleur: "#1E40AF" }, // bleu
  B: { parc: "Parc Astérix",     couleur: "#B45309" }, // orange foncé
};

// Prix testés avec la méthode Gabor-Granger (en euros).
// Ils sont posés du plus élevé au plus bas, dans le même ordre pour tout le monde.
const PRIX_GG = [40, 55, 70, 85, 100, 115];

// Les 4 questions Van Westendorp, dans l'ordre où elles sont posées.
const QUESTIONS_VW = ["vw_trop_bon_marche", "vw_bon_marche", "vw_cher", "vw_trop_cher"];


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

creerEcransGaborGranger();
appliquerVersion(version);
afficherBandeauTest();

// Liste des écrans de questions, dans l'ordre (sans les écrans de fin)
const ecrans = Array.from(document.querySelectorAll(".ecran:not(.ecran-fin)"));
let numeroEcran = 0;
const reponses = {};            // les réponses de la personne, rangées par nom de question
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
formulaire.addEventListener("change", cacherMessages);


/* ---------- 4. NAVIGATION ---------- */

function passerALaSuite() {
  const ecran = ecrans[numeroEcran];
  const resultat = lireReponse(ecran);

  // Réponse obligatoire : on reste sur l'écran avec un message
  if (resultat.erreur) {
    afficherMessage(messageErreur, resultat.erreur);
    return;
  }
  if (resultat.nom) {
    reponses[resultat.nom] = resultat.valeur;
  }

  // Van Westendorp : si le prix est plus bas que la réponse précédente,
  // on invite poliment à vérifier. Un 2e clic sur le bouton permet de continuer.
  const precedente = ecran.dataset.precedente;
  if (precedente && resultat.valeur < reponses[precedente] && !verificationAffichee) {
    verificationAffichee = true;
    afficherMessage(messageVerification,
      "Petite vérification : ce montant est plus bas que votre réponse précédente (" +
      formaterEuros(reponses[precedente]) + "). Vous pouvez le corriger, " +
      "ou cliquer à nouveau sur «\u00A0Suivant\u00A0» pour le garder.");
    return;
  }

  // Filtre : une réponse « Non » arrête le questionnaire
  if (ecran.hasAttribute("data-filtre") && resultat.valeur === "non") {
    terminer("filtré");
    return;
  }

  // Dernière question : fin du questionnaire
  if (numeroEcran === ecrans.length - 1) {
    terminer("complet");
    return;
  }

  numeroEcran = numeroEcran + 1;
  afficherEcran(numeroEcran, true);
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

// Renvoie { nom, valeur } si la réponse est valable, ou { erreur } sinon.
function lireReponse(ecran) {
  const champ = ecran.querySelector("input");
  if (!champ) {
    return {}; // écran sans question (la présentation de l'offre)
  }

  if (champ.type === "checkbox") {
    return champ.checked
      ? {}
      : { erreur: "Cochez la case «\u00A0J'accepte de participer\u00A0» pour commencer." };
  }

  if (champ.type === "radio") {
    const coche = ecran.querySelector("input:checked");
    if (!coche) {
      return { erreur: "Choisissez une réponse pour continuer." };
    }
    // Les notes de 1 à 5 sont enregistrées comme des nombres
    const valeur = /^\d+$/.test(coche.value) ? Number(coche.value) : coche.value;
    return { nom: champ.name, valeur: valeur };
  }

  // Champ de prix en euros
  const montant = lireMontant(champ.value);
  if (montant === null) {
    return { erreur: "Indiquez un montant en euros, en chiffres." };
  }
  return { nom: champ.name, valeur: montant };
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


/* ---------- 7. PRÉPARATION DE LA LIGNE DE RÉSULTATS ---------- */

function preparerLigne(statut) {
  const ligne = Object.assign({
    id_aleatoire: idAleatoire,
    version: version,
    statut: statut,
    test: modeTest ? "oui" : "non",
  }, reponses);
  if (statut === "complet") {
    ligne.incoherent_vw = vanWestendorpIncoherent() ? "oui" : "non";
    ligne.incoherent_gg = gaborGrangerIncoherent() ? "oui" : "non";
  }
  return ligne;
}

// Incohérent si une réponse est plus basse que la précédente
function vanWestendorpIncoherent() {
  for (let i = 1; i < QUESTIONS_VW.length; i++) {
    if (reponses[QUESTIONS_VW[i]] < reponses[QUESTIONS_VW[i - 1]]) {
      return true;
    }
  }
  return false;
}

// Incohérent si la personne accepte un prix élevé puis refuse un prix plus bas
function gaborGrangerIncoherent() {
  let aDejaDitOui = false;
  for (const prix of prixDuPlusHautAuPlusBas()) {
    const reponse = reponses["gg_" + prix];
    if (reponse === "oui") {
      aDejaDitOui = true;
    } else if (reponse === "non" && aDejaDitOui) {
      return true;
    }
  }
  return false;
}


/* ---------- 8. PETITS OUTILS ---------- */

// Crée un écran « Achèteriez-vous ce billet à X € ? » par prix, du plus élevé au plus bas
function creerEcransGaborGranger() {
  const modele = document.getElementById("modele-gabor-granger");
  for (const prix of prixDuPlusHautAuPlusBas()) {
    modele.insertAdjacentHTML("beforebegin", modele.innerHTML.replaceAll("{prix}", prix));
  }
}

function prixDuPlusHautAuPlusBas() {
  return PRIX_GG.slice().sort(function (a, b) { return b - a; });
}

// Écrit le nom du parc et applique sa couleur
function appliquerVersion(laVersion) {
  const choix = VERSIONS[laVersion];
  document.documentElement.style.setProperty("--couleur-parc", choix.couleur);
  document.querySelectorAll("[data-nom-parc]").forEach(function (element) {
    element.textContent = choix.parc;
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
  return montant.toLocaleString("fr-FR") + " €";
}

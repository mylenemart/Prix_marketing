/**
 * ==========================================================================
 * Google Apps Script — enregistre les réponses du questionnaire
 * dans la Google Sheet à laquelle ce script est rattaché.
 *
 * À coller dans : Google Sheet → Extensions → Apps Script (fichier Code.gs)
 * puis à publier en « Application Web » (voir README.md, étape 3).
 *
 * Une ligne par répondant, colonnes fixes dans l'ordre de COLONNES.
 * Aucune donnée personnelle : le script ne reçoit ni nom, ni e-mail, ni adresse IP.
 * ==========================================================================
 */

// Nom de l'onglet où les réponses sont écrites (créé automatiquement s'il n'existe pas)
const NOM_ONGLET = "Réponses";

// Ordre des colonnes. Si tu changes les prix Gabor-Granger dans script.js,
// change aussi les colonnes gg_… ici (puis publie une nouvelle version).
const COLONNES = [
  "horodatage", "id_aleatoire", "version", "statut", "test",
  "filtre_18ans", "filtre_parc",
  "vw_trop_bon_marche", "vw_bon_marche", "vw_cher", "vw_trop_cher",
  "gg_40", "gg_55", "gg_70", "gg_85", "gg_100", "gg_115",
  "controle",
  "likert_qualite", "likert_envie", "likert_confiance",
  "age", "genre", "situation", "nb_visites",
  "incoherent_vw", "incoherent_gg"
];

// Reçoit les réponses envoyées par le questionnaire (script.js)
function doPost(e) {
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(30000); // évite que deux réponses arrivant en même temps s'écrasent
    const donnees = JSON.parse(e.postData.contents);

    // Contrôle minimal : on refuse ce qui ne vient manifestement pas du questionnaire
    if (["A", "B"].indexOf(donnees.version) === -1 ||
        ["complet", "filtré"].indexOf(donnees.statut) === -1) {
      return repondre({ ok: false, erreur: "Données invalides" });
    }

    const ligne = COLONNES.map(function (colonne) {
      if (colonne === "horodatage") return new Date();
      return nettoyer(donnees[colonne]);
    });
    obtenirOnglet().appendRow(ligne);
    return repondre({ ok: true });
  } catch (erreur) {
    return repondre({ ok: false, erreur: String(erreur) });
  } finally {
    verrou.releaseLock();
  }
}

// Permet de vérifier dans le navigateur que le script est bien publié
function doGet() {
  return repondre({ ok: true, message: "Le script du questionnaire fonctionne." });
}

// À lancer une fois à la main (bouton « Exécuter ») pour créer l'onglet et la ligne de titres
function initialiser() {
  obtenirOnglet();
}

function obtenirOnglet() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let onglet = classeur.getSheetByName(NOM_ONGLET);
  if (!onglet) {
    onglet = classeur.insertSheet(NOM_ONGLET);
  }
  if (onglet.getLastRow() === 0) {
    onglet.appendRow(COLONNES);
    onglet.setFrozenRows(1);
  }
  return onglet;
}

// Garde les nombres tels quels ; pour le texte, limite la longueur et empêche
// qu'une réponse commençant par « = » soit lue comme une formule.
function nettoyer(valeur) {
  if (valeur === undefined || valeur === null) return "";
  if (typeof valeur === "number") return isFinite(valeur) ? valeur : "";
  let texte = String(valeur).slice(0, 100);
  if (/^[=+\-@]/.test(texte)) texte = "'" + texte;
  return texte;
}

function repondre(objet) {
  return ContentService
    .createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}

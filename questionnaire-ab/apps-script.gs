/**
 * ==========================================================================
 * Google Apps Script — enregistre les réponses du questionnaire
 * dans la Google Sheet à laquelle ce script est rattaché.
 *
 * À coller dans : Google Sheet → Extensions → Apps Script (fichier Code.gs)
 * puis à publier en « Application Web » (voir README.md, étape 3).
 *
 * Une ligne par répondant. L'ordre des colonnes est donné par la liste
 * COLONNES de script.js : si tu ajoutes une question au questionnaire,
 * sa colonne s'ajoute toute seule à droite, sans republier ce script.
 * Aucune donnée personnelle : le script ne reçoit ni nom, ni e-mail, ni adresse IP.
 * ==========================================================================
 */

// Nom de l'onglet où les réponses sont écrites (créé automatiquement s'il n'existe pas)
const NOM_ONGLET = "Réponses questionnaire";

// Reçoit les réponses envoyées par le questionnaire (script.js)
function doPost(e) {
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(30000); // évite que deux réponses arrivant en même temps s'écrasent
    const donnees = JSON.parse(e.postData.contents);

    // Contrôle minimal : on refuse ce qui ne vient manifestement pas du questionnaire
    const colonnes = donnees._colonnes;
    if (["A", "B"].indexOf(donnees.version) === -1 ||
        ["complet", "filtré"].indexOf(donnees.statut) === -1 ||
        !Array.isArray(colonnes) || colonnes.length === 0 || colonnes.length > 80 ||
        !colonnes.every(function (c) { return /^[a-z0-9_]{1,40}$/.test(c); })) {
      return repondre({ ok: false, erreur: "Données invalides" });
    }

    const onglet = obtenirOnglet();
    const entetes = preparerEntetes(onglet, colonnes);
    const ligne = entetes.map(function (colonne) {
      if (colonne === "horodatage") return new Date();
      return nettoyer(donnees[colonne]);
    });
    onglet.appendRow(ligne);
    // « colonnes » prouve au questionnaire que c'est bien cette version du script qui a répondu
    return repondre({ ok: true, colonnes: entetes.length });
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

function obtenirOnglet() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  return classeur.getSheetByName(NOM_ONGLET) || classeur.insertSheet(NOM_ONGLET);
}

// Écrit la ligne de titres la première fois, puis ajoute à droite
// les colonnes nouvelles s'il y en a. Renvoie la liste des titres.
function preparerEntetes(onglet, colonnes) {
  let entetes = [];
  if (onglet.getLastRow() > 0) {
    entetes = onglet.getRange(1, 1, 1, onglet.getLastColumn()).getValues()[0].map(String);
  }
  const avant = entetes.length;
  colonnes.forEach(function (colonne) {
    if (entetes.indexOf(colonne) === -1) entetes.push(colonne);
  });
  if (entetes.indexOf("horodatage") === -1) entetes.unshift("horodatage");
  if (entetes.length !== avant) {
    onglet.getRange(1, 1, 1, entetes.length).setValues([entetes]);
    onglet.setFrozenRows(1);
  }
  return entetes;
}

// Garde les nombres tels quels ; pour le texte, limite la longueur et empêche
// qu'une réponse commençant par « = » soit lue comme une formule.
function nettoyer(valeur) {
  if (valeur === undefined || valeur === null) return "";
  if (typeof valeur === "number") return isFinite(valeur) ? valeur : "";
  let texte = String(valeur).slice(0, 300);
  if (/^[=+\-@]/.test(texte)) texte = "'" + texte;
  return texte;
}

function repondre(objet) {
  return ContentService
    .createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}

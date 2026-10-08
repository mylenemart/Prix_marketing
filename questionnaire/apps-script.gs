// Collecte des réponses dans une Google Sheet.
// 1. Crée une Google Sheet, puis Extensions → Apps Script, et colle ce code.
// 2. Déployer → Nouveau déploiement → Application Web, exécuter en tant que « Moi », accès « Tout le monde ».
// 3. Copie l'URL obtenue dans la constante ENDPOINT de index.html.
const COLONNES = [
  "horodatage", "version_ab", "prix_asterix_ab", "prix_disney_ab",
  "age", "situation_familiale", "situation", "residence", "frequence", "occasions",
  "parcs_visites", "achat_billet", "critere_1", "critere_2", "critere_3",
  "vw_trop_bon_marche_asterix", "vw_bonne_affaire_asterix", "vw_cher_asterix", "vw_trop_cher_asterix",
  "vw_trop_bon_marche_disney", "vw_bonne_affaire_disney", "vw_cher_disney", "vw_trop_cher_disney",
  "choix_ab", "accompagnement", "budget_total"
];

function doPost(e) {
  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (feuille.getLastRow() === 0) feuille.appendRow(COLONNES);
  feuille.appendRow(COLONNES.map((c) => e.parameter[c] || ""));
  return ContentService.createTextOutput("ok");
}

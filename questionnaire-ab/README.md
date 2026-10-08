# Questionnaire d'étude de prix (test A/B)

Petit site web qui sert de questionnaire **anonyme** pour mesurer le prix maximum accepté pour une même offre (une journée dans un parc d'attractions), présentée sous deux marques :

- **Version A** : Disneyland Paris
- **Version B** : Parc Astérix

Une seule différence entre A et B : le nom et la couleur du parc. Tout le reste est identique, au mot près.

Projet réalisé pour le cours « Prix et budgets marketing » (M1 Marketing, IAE Clermont Auvergne).

Le site est fait en HTML, CSS et JavaScript « purs » : aucun outil à installer, aucun framework.

---

## Ce que contient le dossier

| Fichier | À quoi il sert |
|---|---|
| `index.html` | Le **contenu** : le texte de tous les écrans du questionnaire. |
| `style.css` | L'**apparence** : couleurs, tailles, gros boutons, mise en page sur téléphone. |
| `script.js` | Le **fonctionnement** : passer d'un écran à l'autre, vérifier les réponses, calculer les indicateurs. |
| `apps-script.gs` | Le script Google qui écrit les réponses dans la Google Sheet (voir étape 3). |
| `README.md` | Ce mode d'emploi. |

## Essayer le questionnaire sur ton ordinateur

1. Télécharge le dossier `questionnaire-prix`.
2. Double-clique sur `index.html` : il s'ouvre dans ton navigateur (Chrome, Firefox, Safari…).
3. Réponds aux questions comme le ferait un participant.

Tant que l'adresse Google Sheet n'est pas renseignée dans `script.js`, rien n'est enregistré : tu peux cliquer librement.

## Déroulé du questionnaire

Une question par écran, une barre de progression en haut, un bouton « Suivant », et des réponses obligatoires.

| # | Écran | Ce qui est enregistré |
|---|---|---|
| 1 | Accueil : objet de l'étude, durée, anonymat, case « J'accepte de participer » | — |
| 2 | Filtre : 18 ans ou plus ? Visite d'un parc (3 dernières années ou 12 prochains mois) ? | `filtre_18ans`, `filtre_parc` (un « Non » arrête le questionnaire : statut « filtré ») |
| 3 | L'offre, en version A ou B | `version` |
| 4 | Van Westendorp : 4 prix en euros, toujours dans le même ordre | `vw_trop_bon_marche`, `vw_bon_marche`, `vw_cher`, `vw_trop_cher`, `incoherent_vw` |
| 4 | Gabor-Granger : « Achèteriez-vous ce billet à X € ? », de 115 € à 40 € | `gg_40` … `gg_115`, `incoherent_gg` |
| 5 | Contrôle : quel parc était présenté ? | `controle` |
| 6 | Perception : 3 affirmations, échelle de 1 à 5 | `likert_qualite`, `likert_envie`, `likert_confiance` |
| 7 | Profil : âge, genre, situation, nombre de visites | `age`, `genre`, `situation`, `nb_visites` |
| — | Écran de remerciement | — |

**Les deux indicateurs de cohérence**

- `incoherent_vw` = « oui » si une réponse Van Westendorp est plus basse que la précédente.
  Pendant le questionnaire, un message poli invite la personne à vérifier, sans la bloquer.
- `incoherent_gg` = « oui » si la personne accepte un prix élevé puis refuse un prix plus bas.

Les montants extrêmes (0 €, 10 000 €…) sont acceptés tels quels : comme le demande le cours, on les signale à l'analyse au lieu de les effacer.

## Modifier le questionnaire

| Je veux changer… | Où ? |
|---|---|
| Le texte d'une question ou d'une réponse | `index.html` (cherche le texte avec Ctrl+F, ou Cmd+F sur Mac) |
| La description de l'offre | `index.html`, bloc `3. L'OFFRE` |
| Le nom ou la couleur d'un parc | `script.js`, tout en haut : `VERSIONS` |
| Les prix Gabor-Granger | `script.js`, tout en haut : `PRIX_GG` |
| Les couleurs neutres, les tailles | `style.css`, les variables tout en haut |

**Règle d'or du test A/B** : ne modifie jamais le texte d'une seule version. Le texte de l'offre est écrit une seule fois dans `index.html` et sert aux deux versions ; seuls le nom et la couleur du parc viennent de `VERSIONS`.

## Le tirage au sort A/B

- À l'ouverture du questionnaire, `script.js` tire au sort la version : une chance sur deux pour A, une chance sur deux pour B (`Math.random`).
- La version tirée est gardée dans la mémoire de l'onglet (`sessionStorage`) : si la personne recharge la page, elle revoit la **même** version.
- Un nouvel onglet ou une nouvelle personne = un nouveau tirage.
- Chaque répondant reçoit aussi un **numéro au hasard** (`id_aleatoire`) qui ne dit rien sur lui. Il sert seulement à repérer un éventuel doublon (même numéro sur deux lignes).
- La version vue est enregistrée dans les réponses (colonne `version`).

## Faire des essais sans fausser les résultats

Ajoute ces paramètres à la fin de l'adresse du questionnaire :

| Adresse | Effet |
|---|---|
| `…/index.html?test=1` | Les réponses sont marquées comme tests (colonne `test` = oui). Version tirée au sort. |
| `…/index.html?version=A` | Force la version A (Disneyland Paris). |
| `…/index.html?version=B` | Force la version B (Parc Astérix). |
| `…/index.html?test=1&version=B` | Les deux à la fois : **c'est le plus pratique pour tes essais**. |

Un bandeau jaune s'affiche en haut de la page dans ces cas-là, pour que tu saches que tu es en mode essai. Les vrais participants ne le voient jamais.

Attention : n'envoie aux participants que le lien **sans** paramètre, sinon le tirage au sort ne se fait pas ou leurs réponses sont comptées comme tests.

## Étape 3 : enregistrer les réponses dans une Google Sheet

GitHub Pages ne stocke rien. Les réponses partent donc vers une Google Sheet, grâce à un petit script Google (le fichier `apps-script.gs`, déjà écrit). Compte 10 minutes.

**Utilise ton compte Gmail personnel** : les comptes universitaires bloquent souvent l'option « Tout le monde » dont on a besoin.

### A. Créer la feuille et coller le script

1. Va sur [sheets.new](https://sheets.new) : une Google Sheet vide s'ouvre. Renomme-la, par exemple « Réponses questionnaire prix ».
2. Menu **Extensions → Apps Script**. Un éditeur de code s'ouvre dans un nouvel onglet.
3. Efface tout ce qui est écrit dans le fichier `Code.gs`.
4. Ouvre `apps-script.gs` (dans ce dossier), copie **tout** son contenu et colle-le dans `Code.gs`.
5. Clique sur l'icône **disquette** (Enregistrer).

### B. Publier le script en « Application Web »

1. En haut à droite, clique sur **Déployer → Nouveau déploiement**.
2. À côté de « Sélectionner le type », clique sur la **roue dentée** → **Application Web**.
3. Remplis :
   - Description : `questionnaire v1`
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
4. Clique sur **Déployer**, puis sur **Autoriser l'accès** et choisis ton compte Google.
5. Google affiche « Google n'a pas validé cette application » : c'est normal, c'est ton propre script. Clique sur **Paramètres avancés**, puis sur **Accéder à … (non sécurisé)**, puis sur **Autoriser**.
6. Copie l'**URL de l'application Web** (elle commence par `https://script.google.com/macros/s/` et se termine par `/exec`).

Vérification : colle cette URL dans ton navigateur. Tu dois voir `{"ok":true,"message":"Le script du questionnaire fonctionne."}`.

### C. Coller l'URL dans `script.js`

Ouvre `script.js`. Tout en haut, dans la partie « 1. RÉGLAGES », remplace la ligne :

```js
const URL_GOOGLE_SCRIPT = "";
```

par (avec TON adresse entre les guillemets) :

```js
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/xxxxxxxx/exec";
```

L'onglet « Réponses » et sa ligne de titres se créent tout seuls à la première réponse reçue.

### Ce qui est enregistré

Une ligne par répondant, toujours dans cet ordre de colonnes :

`horodatage, id_aleatoire, version, statut, test, filtre_18ans, filtre_parc, vw_trop_bon_marche, vw_bon_marche, vw_cher, vw_trop_cher, gg_40, gg_55, gg_70, gg_85, gg_100, gg_115, controle, likert_qualite, likert_envie, likert_confiance, age, genre, situation, nb_visites, incoherent_vw, incoherent_gg`

- Les personnes filtrées ont une ligne avec le statut « filtré » et seulement leurs réponses au filtre.
- Aucune donnée personnelle : ni nom, ni e-mail, ni adresse IP (Google ne transmet pas l'IP au script).
- Si la connexion est mauvaise, le questionnaire réessaie tout seul, puis propose un bouton « Réessayer l'envoi ».
- Si la personne recharge la page après avoir terminé, ses réponses ne sont pas renvoyées.
- En cas de doublon (même `id_aleatoire` sur deux lignes), garde une seule ligne à l'analyse.

### Si tu modifies `apps-script.gs` plus tard

Colle la nouvelle version dans l'éditeur, enregistre, puis **Déployer → Gérer les déploiements → crayon (Modifier) → Version : Nouvelle version → Déployer**. L'URL ne change pas.

## Étape 4 : mettre le questionnaire en ligne avec GitHub Pages

### A. Compte et dépôt

1. Si tu n'as pas de compte : [github.com/signup](https://github.com/signup).
2. Crée un dépôt : bouton **+** en haut à droite → **New repository**. Donne-lui un nom (par exemple `Prix_marketing`), choisis **Public** (obligatoire pour GitHub Pages gratuit), puis **Create repository**.
   Tu as déjà le dépôt `Prix_marketing` : c'est celui qu'on utilise (questionnaire dans le dossier `questionnaire-ab/`).

### B. Envoyer les fichiers

1. Dans ton dépôt, clique sur **Add file → Upload files** (ou sur le lien « uploading an existing file » si le dépôt est vide).
2. Glisse-dépose **les fichiers** `index.html`, `style.css`, `script.js`, `README.md` et `apps-script.gs`. Glisse bien les fichiers eux-mêmes, pas le dossier : `index.html` doit être à la racine du dépôt.
3. En bas, clique sur **Commit changes**.

### C. Activer GitHub Pages

1. Dans le dépôt, onglet **Settings** → menu de gauche **Pages**.
2. Sous « Build and deployment » → Source : **Deploy from a branch**.
3. Branch : **main** et dossier **/ (root)**, puis **Save**.
4. Attends 1 à 2 minutes et recharge la page : l'adresse publique s'affiche en haut (« Your site is live at… »).

L'adresse a cette forme : `https://TON-IDENTIFIANT.github.io/NOM-DU-DEPOT/`.
Dans ton dépôt `Prix_marketing`, le site d'étude de marché est à la racine et ce questionnaire est dans le dossier `questionnaire-ab/`. Son adresse est donc : **https://mylenemart.github.io/Prix_marketing/questionnaire-ab/**

C'est **ce lien, sans rien derrière**, que tu partages aux participants.

### D. Vérifier que tout marche avant de lancer

1. Ouvre `https://mylenemart.github.io/Prix_marketing/questionnaire-ab/?test=1&version=A` : le bandeau jaune affiche « Mode test · Version A forcée » et l'offre montre **Disneyland Paris**. Réponds jusqu'au bout : l'écran final doit dire « Vos réponses ont bien été enregistrées ».
2. Ouvre ta Google Sheet, onglet « Réponses » : une ligne est arrivée avec `version` = A et `test` = oui.
3. Recommence avec `?test=1&version=B` : l'offre montre **Parc Astérix**, et une 2e ligne arrive avec `version` = B.
4. Fais un essai en répondant « Non » au filtre : une ligne arrive avec `statut` = filtré.
5. Ouvre le lien normal dans plusieurs fenêtres de navigation privée : tu dois voir tantôt Disneyland Paris, tantôt Parc Astérix (tirage au sort), sans bandeau jaune.
6. Fais un essai sur ton téléphone.
7. Comme le demande le cours, fais tester le questionnaire par quelques personnes extérieures (avec `?test=1`) avant de le lancer.

Avant l'analyse, retire les lignes où `test` = oui (avec un filtre dans la Google Sheet).

## Republier après une modification

1. Sur GitHub, ouvre le fichier à changer (dans ton dépôt, il est dans le dossier `questionnaire-ab/`), clique sur le **crayon** (Edit), fais ta modification, puis **Commit changes**.
   Ou bien : **Add file → Upload files** et redépose le fichier modifié (il remplace l'ancien).
2. Attends 1 à 2 minutes, puis recharge le site (sur ordinateur : Ctrl+Maj+R, ou Cmd+Maj+R sur Mac).

**Ne change plus le questionnaire une fois la collecte lancée** : les réponses d'avant et d'après ne seraient plus comparables.

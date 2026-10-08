# Questionnaire d'étude de prix (test A/B)

Petit site web qui sert de questionnaire **anonyme** sur le prix d'une journée au Parc Astérix et à Disneyland Paris.

Il contient un **test A/B** : dans la question « quel parc choisiriez-vous avec les prix suivants ? », chaque répondant voit, tiré au hasard, l'un de ces deux jeux de prix :

- **Version A** : Parc Astérix 55 €, Disneyland Paris 55 €
- **Version B** : Parc Astérix 65 €, Disneyland Paris 55 €

Une seule différence entre A et B : le prix affiché pour le Parc Astérix. Tout le reste est identique, au mot près.

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
| 2 | Filtre : 18 ans ou plus ? (un « Non » arrête le questionnaire : statut « filtré ») | `filtre_18ans` |
| 3–6 | Vous : âge, situation familiale, situation, lieu de résidence | `age`, `situation_familiale`, `situation`, `residence` |
| 7–10 | Vos habitudes : fréquence, occasions (sautée si « Jamais »), parcs visités, obtention des billets | `frequence`, `occasions`, `parcs_visites`, `achat_billet` |
| 11 | **Test A/B** : quel parc choisiriez-vous avec les prix affichés ? | `version`, `prix_asterix_ab`, `prix_disney_ab`, `choix_ab` |
| 12 | Classement des 3 critères les plus importants | `critere_1`, `critere_2`, `critere_3` |
| 13–16 | Van Westendorp : 4 seuils de prix, pour chaque parc | `vw_…_asterix`, `vw_…_disney`, `incoherent_vw_asterix`, `incoherent_vw_disney` |
| 17 | Contrôle : quel prix était affiché pour le Parc Astérix ? | `controle` |
| 18 | Avec qui envisageriez-vous cette visite ? | `accompagnement` |
| 19 | Budget total par personne | `budget_total` |
| — | Écran de remerciement | — |

Pour les questions à plusieurs réponses, les réponses cochées sont rangées dans la même case, séparées par « | ».

**Les indicateurs de cohérence**

- `incoherent_vw_asterix` (ou `_disney`) = « oui » si, pour ce parc, une réponse Van Westendorp est plus basse que la précédente.
  Pendant le questionnaire, un message poli invite la personne à vérifier, sans la bloquer. Le cours demande d'écarter ces répondants à l'analyse et d'indiquer combien ont été écartés.
- `controle` : compare-le avec `prix_asterix_ab` pour savoir si la personne a bien vu le prix de sa version.

Les montants extrêmes (0 €, 10 000 €…) sont acceptés tels quels : comme le demande le cours, on les signale à l'analyse au lieu de les effacer.

## Modifier le questionnaire

| Je veux changer… | Où ? |
|---|---|
| Le texte d'une question ou d'une réponse | `index.html` (cherche le texte avec Ctrl+F, ou Cmd+F sur Mac) |
| Les prix du test A/B | `script.js`, tout en haut : `VERSIONS` (pense aussi aux réponses de la question de contrôle dans `index.html`) |
| Ajouter une question | `index.html` (copie un écran existant) **et** `script.js` : ajoute son nom dans `COLONNES` |
| Les couleurs neutres, les tailles | `style.css`, les variables tout en haut |

**Règle d'or du test A/B** : ne modifie jamais le texte d'une seule version. Le texte est écrit une seule fois dans `index.html` et sert aux deux versions ; seuls les prix viennent de `VERSIONS`.

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
| `…/index.html?version=A` | Force la version A (Astérix 55 €, Disneyland 55 €). |
| `…/index.html?version=B` | Force la version B (Astérix 65 €, Disneyland 55 €). |
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

L'onglet « Réponses questionnaire » et sa ligne de titres se créent tout seuls à la première réponse reçue.

### Ce qui est enregistré

Une ligne par répondant, dans l'ordre de la liste `COLONNES` de `script.js` :

`horodatage, id_aleatoire, version, statut, test, prix_asterix_ab, prix_disney_ab, filtre_18ans, age, situation_familiale, situation, residence, frequence, occasions, parcs_visites, achat_billet, choix_ab, critere_1, critere_2, critere_3, vw_trop_bon_marche_asterix, vw_bonne_affaire_asterix, vw_cher_asterix, vw_trop_cher_asterix, vw_trop_bon_marche_disney, vw_bonne_affaire_disney, vw_cher_disney, vw_trop_cher_disney, controle, accompagnement, budget_total, incoherent_vw_asterix, incoherent_vw_disney`

- Si tu ajoutes une question et son nom dans `COLONNES`, la colonne s'ajoute toute seule à droite dans la feuille : pas besoin de toucher au script Google.
- Les personnes filtrées ont une ligne avec le statut « filtré » et seulement leurs réponses au filtre.
- Aucune donnée personnelle : ni nom, ni e-mail, ni adresse IP (Google ne transmet pas l'IP au script).
- Si la connexion est mauvaise, le questionnaire réessaie tout seul, puis propose un bouton « Réessayer l'envoi ».
- Si la personne recharge la page après avoir terminé, ses réponses ne sont pas renvoyées.
- En cas de doublon (même `id_aleatoire` sur deux lignes), garde une seule ligne à l'analyse.

### Si tu modifies `apps-script.gs` plus tard

Colle la nouvelle version dans l'éditeur et enregistre. Le plus simple ensuite : **Déployer → Nouveau déploiement** (mêmes réglages : Application Web, Moi, Tout le monde), puis colle la nouvelle URL dans `script.js`.

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

1. Ouvre `https://mylenemart.github.io/Prix_marketing/questionnaire-ab/?test=1&version=A` : le bandeau jaune affiche « Mode test · Version A forcée » et la question du choix entre les parcs montre **Astérix 55 €**. Réponds jusqu'au bout : l'écran final doit dire « Vos réponses ont bien été enregistrées ».
2. Ouvre ta Google Sheet, onglet « Réponses questionnaire » : une ligne est arrivée avec `version` = A et `test` = oui.
3. Recommence avec `?test=1&version=B` : la question montre **Astérix 65 €**, et une 2e ligne arrive avec `version` = B.
4. Fais un essai en répondant « Non » au filtre : une ligne arrive avec `statut` = filtré.
5. Ouvre le lien normal dans plusieurs fenêtres de navigation privée : tu dois voir tantôt 55 €, tantôt 65 € pour Astérix (tirage au sort), sans bandeau jaune.
6. Fais un essai sur ton téléphone.
7. Comme le demande le cours, fais tester le questionnaire par quelques personnes extérieures (avec `?test=1`) avant de le lancer.

Avant l'analyse, retire les lignes où `test` = oui (avec un filtre dans la Google Sheet).

## Republier après une modification

1. Sur GitHub, ouvre le fichier à changer (dans ton dépôt, il est dans le dossier `questionnaire-ab/`), clique sur le **crayon** (Edit), fais ta modification, puis **Commit changes**.
   Ou bien : **Add file → Upload files** et redépose le fichier modifié (il remplace l'ancien).
2. Attends 1 à 2 minutes, puis recharge le site (sur ordinateur : Ctrl+Maj+R, ou Cmd+Maj+R sur Mac).

**Ne change plus le questionnaire une fois la collecte lancée** : les réponses d'avant et d'après ne seraient plus comparables.

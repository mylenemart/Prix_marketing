/* ==========================================================================
   traduction.js — version anglaise du questionnaire
   La langue est choisie d'après la langue de l'appareil (téléphone, ordinateur) :
   - appareil en français → questionnaire en français ;
   - toute autre langue   → questionnaire en anglais.
   Pour tes essais : ajoute ?lang=en ou ?lang=fr à la fin de l'adresse.

   Seuls les textes affichés sont traduits : les réponses enregistrées dans la
   Google Sheet restent en français, pour que toutes les lignes se comparent.
   Pour corriger une traduction : modifie le texte anglais (à droite) ci-dessous.
   Le texte français (à gauche) doit rester identique à celui de index.html.
   ========================================================================== */

const LANGUE = choisirLangue();

function choisirLangue() {
  const forcee = new URLSearchParams(window.location.search).get("lang");
  if (forcee === "fr" || forcee === "en") return forcee;
  const langues = navigator.languages && navigator.languages.length
    ? navigator.languages : [navigator.language || "fr"];
  for (const l of langues) {
    const code = String(l).toLowerCase().slice(0, 2);
    if (code === "fr" || code === "en") return code;
  }
  return "en";
}

// Choisit le texte français ou anglais (pour les messages écrits par script.js)
function t(francais, anglais) {
  return LANGUE === "en" ? anglais : francais;
}

const TEXTES_ANGLAIS = {
  // Page
  "Questionnaire – étude universitaire": "Questionnaire – university study",
  "Progression du questionnaire": "Questionnaire progress",
  "Questionnaire anonyme — étude universitaire, IAE Clermont Auvergne": "Anonymous questionnaire — university study, IAE Clermont Auvergne",
  "Commencer": "Start",
  "Suivant": "Next",
  "Envoyer mes réponses": "Submit my answers",
  "Réessayer l'envoi": "Try sending again",

  // Accueil
  "Étude sur le prix d'une journée en parc d'attractions": "Study on the price of a day at a theme park",
  "Dans le cadre d'un cours de marketing (Master 1, IAE Clermont Auvergne), nous étudions comment les consommateurs perçoivent le prix d'un billet de parc d'attractions.":
    "As part of a marketing course (Master's year 1, IAE Clermont Auvergne), we are studying how consumers perceive the price of a theme park ticket.",
  "Durée :": "Duration:",
  "environ 5 minutes.": "about 5 minutes.",
  "Anonyme :": "Anonymous:",
  "vos réponses sont anonymes.": "your answers are anonymous.",
  "Utilisation :": "Use:",
  "vos réponses servent uniquement à un travail universitaire.": "your answers are used only for university coursework.",
  "Il n'y a pas de bonne ou de mauvaise réponse. Vous pouvez arrêter à tout moment en fermant la page.":
    "There are no right or wrong answers. You can stop at any time by closing the page.",
  "J'accepte de participer": "I agree to take part",

  // Filtre
  "Avez-vous 18 ans ou plus ?": "Are you 18 or older?",
  "Oui": "Yes",
  "Non": "No",

  // Vous
  "Vous": "About you",
  "Quel âge avez-vous ?": "How old are you?",
  "ans": "years",
  "Quelle est votre situation familiale ?": "What is your family situation?",
  "Célibataire sans enfant": "Single, no children",
  "En couple sans enfant": "In a couple, no children",
  "En couple avec enfant(s)": "In a couple, with child(ren)",
  "Parent seul avec enfant(s)": "Single parent with child(ren)",
  "Autre": "Other",
  "Quelle est votre situation ?": "What is your current situation?",
  "Étudiant(e)": "Student",
  "En activité": "Employed",
  "Sans emploi": "Unemployed",
  "Retraité(e)": "Retired",
  "Où habitez-vous ?": "Where do you live?",
  "Île-de-France": "Île-de-France (Paris region)",
  "Hauts-de-France": "Hauts-de-France",
  "Autre région de France": "Another region of France",
  "Hors de France": "Outside France",

  // Vos habitudes
  "Vos habitudes": "Your habits",
  "À quelle fréquence allez-vous dans un parc d'attractions ?": "How often do you go to a theme park?",
  "Plusieurs fois par an": "Several times a year",
  "Environ une fois par an": "About once a year",
  "Tous les deux ou trois ans": "Every two or three years",
  "Moins d'une fois tous les trois ans": "Less than once every three years",
  "Jamais": "Never",
  "À quelles occasions y allez-vous ?": "On what occasions do you go?",
  "Plusieurs réponses possibles.": "Several answers possible.",
  "Vacances scolaires": "School holidays",
  "Week-end": "Weekend",
  "Anniversaire": "Birthday",
  "Sortie entre amis": "Outing with friends",
  "Sortie en famille": "Family outing",
  "Événement saisonnier (Halloween, Noël…)": "Seasonal event (Halloween, Christmas…)",
  "Sortie organisée (école, entreprise, association)": "Organised trip (school, company, club)",
  "Quels parcs avez-vous déjà visités ?": "Which parks have you already visited?",
  "Aucun des deux": "Neither",
  "Comment avez-vous obtenu vos billets de parc ?": "How did you get your park tickets?",
  "Achat personnel sur le site du parc": "Bought myself on the park's website",
  "Achat personnel via un revendeur ou un site de réduction": "Bought myself through a reseller or discount website",
  "Comité d'entreprise ou CSE": "Through my employer's works council",
  "Cadeau": "Gift",
  "Offre d'une marque ou d'un partenaire": "Offer from a brand or partner",
  "Pass annuel": "Annual pass",
  "Je n'ai jamais acheté ni reçu de billet": "I have never bought or received a ticket",
  "Selon vous, y a-t-il beaucoup de monde dans chaque parc ?": "In your opinion, how crowded is each park?",
  "Pensez à l'affluence et aux files d'attente. Une réponse par parc.": "Think about crowds and queues. One answer per park.",
  "Peu de monde": "Not crowded",
  "Raisonnable": "Reasonable",
  "Beaucoup de monde": "Very crowded",
  "Saturé": "Overcrowded",

  // Vos choix
  "Vos choix": "Your choices",
  "Pour un billet adulte d'une journée, sans transport ni hôtel, quel parc choisiriez-vous avec les offres suivantes ?":
    "For a one-day adult ticket, without transport or hotel, which park would you choose with the following offers?",
  "une peluche incluse": "a plush toy included",
  "Quelle importance ont ces critères dans le choix d'un parc ?": "How important are these criteria when choosing a park?",
  "Une réponse par ligne, de 1 (pas important) à 5 (très important).": "One answer per row, from 1 (not important) to 5 (very important).",
  "Plusieurs réponses possibles. Ne cochez rien si vous n'en avez visité aucun.": "Several answers possible. Leave blank if you have visited neither.",
  "Le prix du billet": "The ticket price",
  "Les attractions et les sensations fortes": "The rides and thrills",
  "L'univers et les décors": "The theme and settings",
  "Les spectacles": "The shows",
  "Les activités adaptées aux enfants": "Activities suited to children",
  "Le temps d'attente": "Waiting times",
  "La facilité d'accès": "Ease of access",

  // Van Westendorp
  "Vos seuils de prix": "Your price thresholds",
  "Pour un billet adulte d'une journée, donnant accès à un seul parc, sans transport ni hôtel. Indiquez le prix qui vous vient spontanément, en euros.":
    "For a one-day adult ticket, giving access to one park only, without transport or hotel. Give the price that first comes to mind, in euros.",
  "À partir de quel prix le billet vous semblerait-il si peu cher que vous douteriez de la qualité de l'expérience ?":
    "At what price would the ticket seem so cheap that you would doubt the quality of the experience?",
  "À partir de quel prix le billet vous semblerait-il une bonne affaire ?":
    "At what price would the ticket seem a good deal?",
  "À partir de quel prix le billet vous semblerait-il cher, mais vous pourriez encore l'acheter ?":
    "At what price would the ticket seem expensive, but you would still consider buying it?",
  "À partir de quel prix le billet vous semblerait-il trop cher pour envisager de l'acheter ?":
    "At what price would the ticket seem too expensive to consider buying it?",

  // Contrôle et fin du questionnaire
  "Pour finir": "Final questions",
  "Je ne sais pas": "I don't know",
  "Avec qui envisageriez-vous cette visite ?": "Who would you go on this visit with?",
  "Seul(e)": "Alone",
  "En couple": "As a couple",
  "Entre amis": "With friends",
  "En famille avec enfants": "With family, including children",
  "En famille sans enfants": "With family, no children",
  "Quel budget total pourriez-vous consacrer à cette sortie, par personne, en incluant le billet, le transport et les repas ?":
    "What total budget could you spend on this outing, per person, including ticket, transport and meals?",
  "Merci pour votre intérêt": "Thank you for your interest",
  "Cette étude s'adresse à un profil de participants précis : le questionnaire s'arrête donc ici pour vous.":
    "This study is aimed at a specific group of participants, so the questionnaire ends here for you.",
  "Merci pour votre temps !": "Thank you for your time!",
  "Merci pour votre participation !": "Thank you for taking part!",
  "Vous pouvez maintenant fermer cette page.": "You can now close this page.",
};

// Traduit un texte s'il figure dans la liste (sinon le renvoie tel quel)
function traduireTexte(texte) {
  if (LANGUE !== "en") return texte;
  return TEXTES_ANGLAIS[texte.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()] || texte;
}

// Remplace les textes de la page par leur version anglaise.
// Les « value » des réponses ne sont pas touchées : la Sheet reste en français.
function traduireLaPage() {
  if (LANGUE !== "en") return;
  document.documentElement.lang = "en";

  const traduire = function (texte) {
    const cle = texte.replace(/ /g, " ").replace(/\s+/g, " ").trim();
    return TEXTES_ANGLAIS[cle];
  };

  const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const noeuds = [];
  while (parcours.nextNode()) noeuds.push(parcours.currentNode);
  noeuds.forEach(function (noeud) {
    const anglais = traduire(noeud.nodeValue);
    if (anglais) {
      // garde les espaces autour du texte (par ex. après « Durée : » en gras)
      const avant = noeud.nodeValue.match(/^\s*/)[0], apres = noeud.nodeValue.match(/\s*$/)[0];
      noeud.nodeValue = avant + anglais + apres;
    }
  });

  document.title = traduire(document.title) || document.title;
  document.querySelectorAll("[aria-label]").forEach(function (el) {
    const anglais = traduire(el.getAttribute("aria-label"));
    if (anglais) el.setAttribute("aria-label", anglais);
  });
  document.querySelectorAll("[data-bouton]").forEach(function (el) {
    const anglais = traduire(el.dataset.bouton);
    if (anglais) el.dataset.bouton = anglais;
  });
}

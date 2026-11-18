/* Navigation par onglets : un seul panneau visible à la fois, choisi par l'ancre de l'URL (#prix, #finances…).
   Sans ancre, on affiche le panneau par défaut (data-defaut sur <body>) : la page de garde à l'accueil. */
(function () {
  var racine = document.documentElement;
  racine.classList.add("js-onglets");
  var defaut = document.body.getAttribute("data-defaut") || "accueil";

  var panneaux = Array.prototype.slice.call(document.querySelectorAll("#accueil, main > section[id]"));
  var ids = panneaux.map(function (p) { return p.id; });
  var liens = Array.prototype.slice.call(document.querySelectorAll("nav.onglets a, nav.sous-onglets a"));

  function hauteurNav() {
    var nav = document.querySelector("nav.top");
    if (nav) racine.style.setProperty("--hauteur-nav", nav.offsetHeight + "px");
  }

  function afficher(cible, defiler) {
    var id = ids.indexOf(cible) >= 0 ? cible : null;
    if (!id && cible) {
      // ancre d'un élément à l'intérieur d'un panneau : on ouvre ce panneau
      var el = document.getElementById(cible);
      var parent = el && el.closest("main > section[id]");
      id = parent ? parent.id : null;
    }
    if (!id) id = defaut;

    panneaux.forEach(function (p) { p.classList.toggle("actif", p.id === id); });
    document.querySelectorAll("[data-onglet]").forEach(function (el) {
      el.classList.toggle("actif", el.getAttribute("data-onglet") === id);
    });
    document.body.setAttribute("data-vue", id);

    liens.forEach(function (a) {
      var h = a.getAttribute("href") || "";
      // seuls les liens vers une ancre de cette page (« #prix ») comptent ; les autres onglets pointent vers une autre page
      var cibleLien = h.charAt(0) === "#" ? h.slice(1) : null;
      var actif = (cibleLien === id && id !== "accueil") || a.hasAttribute("data-actif-ici");
      if (actif) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      var boite = a.closest(".wrap");
      if (actif && boite && a.offsetLeft + a.offsetWidth > boite.scrollLeft + boite.clientWidth) {
        boite.scrollLeft = a.offsetLeft + a.offsetWidth - boite.clientWidth + 24;
      }
    });

    // le navigateur saute d'abord à l'ancre : on remonte en haut juste après
    if (defiler) setTimeout(function () { window.scrollTo(0, 0); }, 0);
    return document.querySelector("#" + id + " h1, #" + id + " h2");
  }

  window.addEventListener("hashchange", function () {
    var titre = afficher(location.hash.slice(1), true);
    if (titre) { titre.setAttribute("tabindex", "-1"); titre.focus({ preventScroll: true }); }
  });
  window.addEventListener("resize", hauteurNav);
  window.addEventListener("load", function () { hauteurNav(); if (location.hash) window.scrollTo(0, 0); });
  hauteurNav();
  afficher(location.hash.slice(1), true);
})();

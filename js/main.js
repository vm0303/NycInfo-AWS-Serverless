"use strict";
(function () {
  const root = document.documentElement;
  const btn = document.querySelector(".btn-menu");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    root.classList.toggle("menu-opened");
  });
})();

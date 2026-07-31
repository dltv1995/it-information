"use strict";

(() => {
  const agencyList = document.querySelector("#agencyList");
  const agencies = Array.isArray(window.AR_AGENCIES)
    ? window.AR_AGENCIES
    : [];

  agencies.forEach((agency, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "agency-card";

    button.innerHTML = `
      <span class="agency-no">
        ${String(index + 1).padStart(2, "0")}
      </span>

      <span class="logo-wrap">
        <img src="${agency.logo}" alt="">
      </span>

      <span class="agency-name">
        ${agency.title}
      </span>

      <span class="arrow">›</span>
    `;

    const logoImage = button.querySelector("img");

    logoImage.addEventListener("error", () => {
      logoImage.remove();
      button.querySelector(".logo-wrap").classList.add("no-image");
    });

    button.addEventListener("click", () => {
      const parameters = new URLSearchParams({
        agency: String(index),
        id: agency.id,
        revision: String(agency.revision ?? 1)
      });

      window.location.href = `./scan.html?${parameters.toString()}`;
    });

    agencyList.appendChild(button);
  });
})();

// app/aa95/index.js

async function loadPanelSVG() {
  const container = document.getElementById("panel-container");
  const response = await fetch("/app/aa95/aa95-panel.svg");
  const svgText = await response.text();
  container.innerHTML = svgText;
  
  // Once the SVG is in the DOM, run your initialization
  initializePanel();
}

// Your existing initialization logic
function initializePanel() {
  // import or call other modules as needed:
  import("./dom.js").then(({ setupDOM }) => setupDOM());
  import("./toggles.js").then(({ initToggles }) => initToggles());
  import("./selector.js").then(({ initSelector }) => initSelector());
  import("./status.js").then(({ initStatusUI }) => initStatusUI());
}

// Load panel
loadPanelSVG();

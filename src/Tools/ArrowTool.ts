
// ARROW ANNOTATE TOOL 

import * as cornerstoneTools from "cornerstone-tools";
import * as cornerstone from "cornerstone-core";

export function setupArrowTool(element: HTMLElement) {
  const { ArrowAnnotateTool } = cornerstoneTools;

  // Registrar la herramienta si no existe
  if (!cornerstoneTools.store.state.tools.find((t: { name: string }) => t.name === "ArrowAnnotate")) {
    cornerstoneTools.addTool(ArrowAnnotateTool);
  }

  const arrowBtn = document.getElementById("arrowBtn") as HTMLButtonElement | null;
  if (!arrowBtn) {
    console.warn("⚠️ No se encontró el botón #arrowBtn.");
    return;
  }

  let active = false;

  arrowBtn.addEventListener("click", () => {
    active = !active;
    arrowBtn.classList.toggle("active", active);

    if (active) {
      cornerstoneTools.setToolActiveForElement(element, "ArrowAnnotate", {
        mouseButtonMask: 1,
      });
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "ArrowAnnotate");
    }
  });
}



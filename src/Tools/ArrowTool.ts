// ARROW ANNOTATE TOOL

import * as cornerstoneTools from "cornerstone-tools";
import * as cornerstone from "cornerstone-core";
import { registerTool, activateTool } from "./toolStateManager";

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

  let arrowActive = false;

  
  // Registro global
 
  registerTool("arrow", () => {
    arrowActive = false;
    arrowBtn.classList.remove("active");
    element.style.cursor = "default";
    cornerstoneTools.setToolPassiveForElement(element, "ArrowAnnotate");
  });

 
  // Activar / desactivar herramienta
 
  arrowBtn.addEventListener("click", () => {
    if (!arrowActive) {
      activateTool("arrow");
      arrowActive = true;
      arrowBtn.classList.add("active");
      element.style.cursor = "crosshair";
      cornerstoneTools.setToolActiveForElement(element, "ArrowAnnotate", {
        mouseButtonMask: 1,
      });
    } else {
      arrowActive = false;
      arrowBtn.classList.remove("active");
      element.style.cursor = "default";
      cornerstoneTools.setToolPassiveForElement(element, "ArrowAnnotate");
    }
  });
}




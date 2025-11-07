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
    console.warn("No se encontró el botón #arrowBtn.");
    return;
  }

// Flag global de la herramienta dentro de este setup
let arrowActive = false;

// Render: visible pero sin interacción inicialmente
cornerstoneTools.setToolEnabledForElement(element, "ArrowAnnotate");
cornerstoneTools.setToolLockedForElement?.(element, "ArrowAnnotate", true);



  
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
      cornerstoneTools.setToolActiveForElement(element, "ArrowAnnotate", { mouseButtonMask: 1 });
      cornerstoneTools.setToolLockedForElement?.(element, "ArrowAnnotate", false);

    } else {
      arrowActive = false;
      arrowBtn.classList.remove("active");
      element.style.cursor = "default";
      cornerstoneTools.setToolEnabledForElement(element, "ArrowAnnotate");
      cornerstoneTools.setToolLockedForElement?.(element, "ArrowAnnotate", true);

    }
  });

  // --- GUARD: evita hover o movimiento de la flecha si el botón está apagado ---
function isPointNearArrow(e: MouseEvent): boolean {
  const toolState = cornerstoneTools.getToolState(element, "ArrowAnnotate");
  if (!toolState || !toolState.data || toolState.data.length === 0) return false;

  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  // Tolerancia de detección (en píxeles)
  const tolerance = 10;

  return toolState.data.some((arrow: any) => {
    const start = cornerstone.pixelToCanvas(element, arrow.handles.start);
    const end = cornerstone.pixelToCanvas(element, arrow.handles.end);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) return false;

    const t = Math.max(0, Math.min(1, ((clickCanvas.x - start.x) * dx + (clickCanvas.y - start.y) * dy) / lengthSq));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const dist = Math.sqrt((clickCanvas.x - projX) ** 2 + (clickCanvas.y - projY) ** 2);

    return dist <= tolerance;
  });
}

const guardArrowInteraction = (e: MouseEvent) => {
  if (!arrowActive && isPointNearArrow(e)) {
    e.stopImmediatePropagation();
    e.preventDefault();

    const toolState = cornerstoneTools.getToolState(element, "ArrowAnnotate");
    if (toolState?.data) {
      toolState.data.forEach((a: any) => {
        a.active = false;
        a.highlight = false;
      });
      cornerstone.updateImage(element);
    }
  }
};

element.addEventListener("mousemove", guardArrowInteraction);
element.addEventListener("mousedown", guardArrowInteraction);

}




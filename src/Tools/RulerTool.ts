// RULER TOOL

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
import { registerTool, activateTool } from "./toolStateManager";

  export function setupRulerTool(element: HTMLElement) {
  const LengthTool = cornerstoneTools.LengthTool;
  cornerstoneTools.addTool(LengthTool);

  // Estado inicial: visible pero sin interacción
  cornerstoneTools.setToolEnabledForElement(element, "Length");
  cornerstoneTools.setToolLockedForElement?.(element, "Length", true);

  const measureBtn = document.getElementById("measureBtn") as HTMLButtonElement;
  let measureActive = false;

  // Registro global
    registerTool("ruler", () => {
    measureActive = false;
    measureBtn.classList.remove("active");
    element.style.cursor = "default";

    // Deja visibles las medidas pero sin permitir interacción
    cornerstoneTools.setToolEnabledForElement(element, "Length");
    cornerstoneTools.setToolLockedForElement?.(element, "Length", true);
  });

  // Activar / desactivar herramienta
  measureBtn.addEventListener("click", () => {
    if (!measureActive) {
      activateTool("ruler");
      measureActive = true;
      measureBtn.classList.add("active");
      element.style.cursor = "crosshair";

      cornerstoneTools.setToolActiveForElement(element, "Length", {
        mouseButtonMask: 1,
      });
      cornerstoneTools.setToolLockedForElement?.(element, "Length", false);
    } else {
      measureActive = false;
      measureBtn.classList.remove("active");
      element.style.cursor = "default";

      cornerstoneTools.setToolEnabledForElement(element, "Length");
      cornerstoneTools.setToolLockedForElement?.(element, "Length", true);
    }
  });

  // Doble clic para eliminar una medición
  element.addEventListener("dblclick", (e: MouseEvent) => {
    if (!measureActive) return;

    const toolState = cornerstoneTools.getToolState(element, "Length");
    if (!toolState || !toolState.data || toolState.data.length === 0) return;

    const lengths = toolState.data;
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, coords);

    // Tolerancia de proximidad para eliminar (px)
    const tolerance = 10;

    const indexToRemove = lengths.findIndex((line: any) => {
      const start = cornerstone.pixelToCanvas(element, line.handles.start);
      const end = cornerstone.pixelToCanvas(element, line.handles.end);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) return false;

      const t = Math.max(
        0,
        Math.min(1, ((clickCanvas.x - start.x) * dx + (clickCanvas.y - start.y) * dy) / lengthSq)
      );
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      const dist = Math.sqrt(
        (clickCanvas.x - projX) ** 2 + (clickCanvas.y - projY) ** 2
      );

      return dist <= tolerance;
    });

    if (indexToRemove !== -1) {
      lengths.splice(indexToRemove, 1);
      cornerstone.updateImage(element);
    }
  });

  // --- GUARD: evita hover o movimiento de líneas si el botón está apagado ---
  function isPointNearRuler(e: MouseEvent): boolean {
    const toolState = cornerstoneTools.getToolState(element, "Length");
    if (!toolState || !toolState.data || toolState.data.length === 0) return false;

    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, coords);
    const tolerance = 10;

    return toolState.data.some((line: any) => {
      const start = cornerstone.pixelToCanvas(element, line.handles.start);
      const end = cornerstone.pixelToCanvas(element, line.handles.end);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) return false;

      const t = Math.max(
        0,
        Math.min(1, ((clickCanvas.x - start.x) * dx + (clickCanvas.y - start.y) * dy) / lengthSq)
      );
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      const dist = Math.sqrt(
        (clickCanvas.x - projX) ** 2 + (clickCanvas.y - projY) ** 2
      );

      return dist <= tolerance;
    });
  }

  const guardRulerInteraction = (e: MouseEvent) => {
    if (!measureActive && isPointNearRuler(e)) {
      e.stopImmediatePropagation();
      e.preventDefault();

      const toolState = cornerstoneTools.getToolState(element, "Length");
      if (toolState?.data) {
        toolState.data.forEach((l: any) => {
          l.active = false;
          l.highlight = false;
        });
        cornerstone.updateImage(element);
      }
    }
  };

  element.addEventListener("mousemove", guardRulerInteraction);
  element.addEventListener("mousedown", guardRulerInteraction);

}



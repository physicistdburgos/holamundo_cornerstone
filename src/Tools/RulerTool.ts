// RULER TOOL

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
import { registerTool, activateTool } from "./toolStateManager";

export function setupRulerTool(element: HTMLElement) {
  const LengthTool = cornerstoneTools.LengthTool;
  cornerstoneTools.addTool(LengthTool);
  cornerstoneTools.setToolPassiveForElement(element, "Length");

  const measureBtn = document.getElementById("measureBtn") as HTMLButtonElement;
  const toggleMeasurementsBtn = document.getElementById("toggleMeasurementsBtn") as HTMLButtonElement;

  let measureActive = false;
  let savedLengthData: any[] | null = null;

  
  // Registro global
  
  registerTool("ruler", () => {
    measureActive = false;
    measureBtn.classList.remove("active");
    element.style.cursor = "default";
    cornerstoneTools.setToolPassiveForElement(element, "Length");
  });

  
  // Activar / desactivar herramienta
  
  measureBtn.addEventListener("click", () => {
    if (!measureActive) {
      activateTool("ruler");
      cornerstoneTools.setToolActiveForElement(element, "Length", {
        mouseButtonMask: 1,
      });
      measureBtn.classList.add("active");
      element.style.cursor = "crosshair";
      measureActive = true;
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "Length");
      measureBtn.classList.remove("active");
      element.style.cursor = "default";
      measureActive = false;
    }
  });

  
  // Mostrar / Ocultar mediciones
  
  toggleMeasurementsBtn?.addEventListener("click", () => {
    const state = cornerstoneTools.getToolState(element, "Length");

    if (savedLengthData === null) {
      const current = state?.data ?? [];
      if (current.length === 0) return;

      savedLengthData = current.map((d: any) => ({ ...d }));
      cornerstoneTools.clearToolState(element, "Length");
      cornerstone.updateImage(element);

      toggleMeasurementsBtn.classList.remove("active");
      toggleMeasurementsBtn.textContent = "Medidas OFF";
    } else {
      cornerstoneTools.clearToolState(element, "Length");
      savedLengthData.forEach((d) =>
        cornerstoneTools.addToolState(element, "Length", d)
      );
      savedLengthData = null;
      cornerstone.updateImage(element);

      toggleMeasurementsBtn.classList.add("active");
      toggleMeasurementsBtn.textContent = "Medidas ON";
    }
  });
}

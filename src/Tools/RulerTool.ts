// src/Tools/RulerTool.ts

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
export function setupRulerTool(element: HTMLElement) {
  // ...

// Herramienta de Medir
  
  const LengthTool = cornerstoneTools.LengthTool;
  cornerstoneTools.addTool(LengthTool);
  cornerstoneTools.setToolPassiveForElement(element, "Length");

  const measureBtn = document.getElementById("measureBtn") as HTMLButtonElement;
  let measureActive = false;

  measureBtn.addEventListener("click", () => {
    if (!measureActive) {
      cornerstoneTools.setToolActiveForElement(element, "Length", {
        mouseButtonMask: 1, // clic izquierdo para medir
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
  
  const toggleMeasurementsBtn = document.getElementById(
    "toggleMeasurementsBtn"
  ) as HTMLButtonElement;

  // Guardará temporalmente las mediciones cuando estén ocultas
  let savedLengthData: any[] | null = null;

  toggleMeasurementsBtn.addEventListener("click", () => {
    const state = cornerstoneTools.getToolState(element, "Length");

    if (savedLengthData === null) {
      // Ocultar: guardar y limpiar
      const current = state?.data ?? [];
      if (current.length === 0) return; // no hay nada que ocultar

      // Guardar copia
      savedLengthData = current.map((d: any) => ({ ...d }));

      // Limpiar del visor
      cornerstoneTools.clearToolState(element, "Length");
      cornerstone.updateImage(element);

      toggleMeasurementsBtn.classList.remove("active");
      toggleMeasurementsBtn.textContent = "Medidas OFF";
    } else {
      // Mostrar: restaurar las guardadas
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
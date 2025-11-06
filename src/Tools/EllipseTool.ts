// src/Tools/EllipseTool.ts

// ELLIPSE TOOL

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
export function setupEllipseTool(element: HTMLElement) {

let ellipses: any[] = [];
const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool;
cornerstoneTools.addTool(EllipticalRoiTool);
cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");

const ellipseBtn = document.getElementById("ellipseBtn") as HTMLButtonElement;
let ellipseActive = false;

ellipseBtn.addEventListener("click", () => {
  if (!ellipseActive) {
    // Activar herramienta elipse ROI
    cornerstoneTools.setToolActiveForElement(element, "EllipticalRoi", {
      mouseButtonMask: 1,
    });
    ellipseBtn.classList.add("active");
    element.style.cursor = "crosshair";
    ellipseActive = true;
  } else {
    // Desactivar herramienta
    cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");
    ellipseBtn.classList.remove("active");
    element.style.cursor = "default";
    ellipseActive = false;
  }
});

// =============================
// Doble clic para eliminar una elipse
// =============================
element.addEventListener("dblclick", (e: MouseEvent) => {
  // Verifica si hay alguna elipse almacenada
  if (!ellipses || ellipses.length === 0) return;

  // Obtiene las coordenadas del clic en espacio de imagen
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  // Encuentra la elipse más cercana al punto del clic
  const distances = ellipses.map((ellipse) => {
    const startCanvas = cornerstone.pixelToCanvas(element, ellipse.start);
    const endCanvas = cornerstone.pixelToCanvas(element, ellipse.end);
    const cx = (startCanvas.x + endCanvas.x) / 2;
    const cy = (startCanvas.y + endCanvas.y) / 2;
    const rx = Math.abs(endCanvas.x - startCanvas.x) / 2;
    const ry = Math.abs(endCanvas.y - startCanvas.y) / 2;
    const dx = (clickCanvas.x - cx) / rx;
    const dy = (clickCanvas.y - cy) / ry;
    // Distancia normalizada al borde de la elipse
    return Math.abs(dx * dx + dy * dy - 1);
  });

  const minDist = Math.min(...distances);
  const indexToRemove = distances.indexOf(minDist);

  // Si el clic está razonablemente cerca (dentro o sobre la elipse)
  if (minDist < 0.2) {
    ellipses.splice(indexToRemove, 1);
    cornerstone.updateImage(element);
  }
});

}
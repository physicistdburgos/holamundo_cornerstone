// ELLIPSE TOOL

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
import { registerTool, activateTool } from "./toolStateManager";

export function setupEllipseTool(element: HTMLElement) {
  const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool;
  cornerstoneTools.addTool(EllipticalRoiTool);
  cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");

  const ellipseBtn = document.getElementById("ellipseBtn") as HTMLButtonElement;
  let ellipseActive = false;

  
  // Registro en el sistema global
  
  registerTool("ellipse", () => {
    ellipseActive = false;
    ellipseBtn.classList.remove("active");
    element.style.cursor = "default";
    cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");
  });

  
  // Activar / desactivar herramienta
  
  ellipseBtn.addEventListener("click", () => {
    if (!ellipseActive) {
      activateTool("ellipse");
      cornerstoneTools.setToolActiveForElement(element, "EllipticalRoi", {
        mouseButtonMask: 1,
      });
      ellipseBtn.classList.add("active");
      element.style.cursor = "crosshair";
      ellipseActive = true;
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");
      ellipseBtn.classList.remove("active");
      element.style.cursor = "default";
      ellipseActive = false;
    }
  });

  
  // Doble clic para eliminar una elipse
  
  element.addEventListener("dblclick", (e: MouseEvent) => {
    if (!ellipseActive) return;

    const toolState = cornerstoneTools.getToolState(element, "EllipticalRoi");
    if (!toolState || !toolState.data || toolState.data.length === 0) return;

    const ellipses = toolState.data;
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, coords);

    const indexToRemove = ellipses.findIndex((ellipse: any) => {
      const start = cornerstone.pixelToCanvas(element, ellipse.handles.start);
      const end = cornerstone.pixelToCanvas(element, ellipse.handles.end);
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const dx = (clickCanvas.x - cx) / rx;
      const dy = (clickCanvas.y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    });

    if (indexToRemove !== -1) {
      ellipses.splice(indexToRemove, 1);
      cornerstone.updateImage(element);
    }
  });
}


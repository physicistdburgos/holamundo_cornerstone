// src/setupTools.ts


//Imports de Cornerstone
import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";

//Imports de tus herramientas ROI (etiquetado)
import { setupPointTool } from "./Tools/PointTool";
import { setupRulerTool } from "./Tools/RulerTool";
import { setupEllipseTool } from "./Tools/EllipseTool";
import { setupRectangleTool } from "./Tools/RectangleTool";
import { setupFreeHandTool } from "./Tools/FreeHandTool";


// setupTools principal

export function setupTools(element: HTMLElement) {
  
  //Herramientas de visualización
  
  setupZoomTool(element);
  setupPanTool(element);
  setupWindowLevelTool(element);
  setupInvertTool(element);
  setupCrosshairTool(element);
  setupRotateTool(element);
  setupRotateTool(element);
  
  //Herramientas de anotación / etiquetado
  
  setupPointTool(element);
  setupRulerTool(element);
  setupEllipseTool(element);
  setupRectangleTool(element);
  setupFreeHandTool(element);
}


// ZOOM TOOL

function setupZoomTool(element: HTMLElement) {
  const zoomBtn = document.getElementById("zoomBtn") as HTMLButtonElement;
  let zoomActive = false;

  zoomBtn?.addEventListener("click", () => {
    zoomActive = !zoomActive;
    zoomBtn.classList.toggle("active");
    element.style.cursor = zoomActive ? "zoom-in" : "default";
  });

  element.addEventListener("wheel", (e: WheelEvent) => {
    if (!zoomActive) return;
    e.preventDefault();
    const viewport = cornerstone.getViewport(element);
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    viewport.scale *= zoomFactor;
    cornerstone.setViewport(element, viewport);
  });
}


//PAN TOOL

function setupPanTool(element: HTMLElement) {
  const panBtn = document.getElementById("panBtn") as HTMLButtonElement;
  let panActive = false;
  let lastPosition: { x: number; y: number } | null = null;

  panBtn?.addEventListener("click", () => {
    panActive = !panActive;
    panBtn.classList.toggle("active");
    element.style.cursor = panActive ? "grab" : "default";
  });

  element.addEventListener("mousedown", (e: MouseEvent) => {
    if (!panActive) return;
    lastPosition = { x: e.clientX, y: e.clientY };
    element.style.cursor = "grabbing";
  });

  element.addEventListener("mousemove", (e: MouseEvent) => {
    if (!panActive || !lastPosition) return;
    const viewport = cornerstone.getViewport(element);
    const dx = e.clientX - lastPosition.x;
    const dy = e.clientY - lastPosition.y;
    viewport.translation.x += dx / viewport.scale;
    viewport.translation.y += dy / viewport.scale;
    cornerstone.setViewport(element, viewport);
    lastPosition = { x: e.clientX, y: e.clientY };
  });

  element.addEventListener("mouseup", () => {
    if (panActive) element.style.cursor = "grab";
    lastPosition = null;
  });
}


//WINDOW WIDTH 

function setupWindowLevelTool(element: HTMLElement) {
  // Rango clínico para mamografía (12 bits)
  const MAMMO_RANGE = {
    minWidth: 100,
    maxWidth: 4095,
    minCenter: -500,
    maxCenter: 4500,
  };

  // Valores iniciales típicos
  let ww = 1200;
  let wc = 600;
  let wwHudTimeout: any = null;

  // HUD overlay
  const hud = document.createElement("div");
  hud.style.position = "absolute";
  hud.style.top = "10px";
  hud.style.left = "15px";
  hud.style.padding = "6px 10px";
  hud.style.borderRadius = "6px";
  hud.style.background = "rgba(0, 0, 0, 0.6)";
  hud.style.color = "white";
  hud.style.fontSize = "13px";
  hud.style.fontFamily = "Arial";
  hud.style.pointerEvents = "none";
  hud.style.opacity = "0";
  hud.style.transition = "opacity 0.4s ease";
  hud.innerText = `WW: ${ww} | WC: ${wc}`;
  element.parentElement?.appendChild(hud);

  function updateWWWC() {
    const viewport = cornerstone.getViewport(element);
    viewport.voi.windowWidth = ww;
    viewport.voi.windowCenter = wc;
    cornerstone.setViewport(element, viewport);
    showHud();
  }

  function showHud() {
    hud.innerText = `WW: ${Math.round(ww)} | WC: ${Math.round(wc)}`;
    hud.style.opacity = "1";
    clearTimeout(wwHudTimeout);
    wwHudTimeout = setTimeout(() => (hud.style.opacity = "0"), 1500);
  }

  // Ajuste con rueda del mouse
  element.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();

    const step = e.deltaY * -0.25; // ajuste fino y natural

    // Aclarar (rueda arriba): aumentar WW, bajar WC
    ww += step;
    wc -= step * 0.5;

    ww = Math.max(MAMMO_RANGE.minWidth, Math.min(MAMMO_RANGE.maxWidth, ww));
    wc = Math.max(MAMMO_RANGE.minCenter, Math.min(MAMMO_RANGE.maxCenter, wc));

    updateWWWC();
  });

  // Doble clic → restablecer valores
  element.addEventListener("dblclick", () => {
    ww = 1200;
    wc = 600;
    updateWWWC();
  });
}


// INVERT TOOL

function setupInvertTool(element: HTMLElement) {
  const invertBtn = document.getElementById("invertBtn") as HTMLButtonElement;
  let invertActive = false;

  invertBtn?.addEventListener("click", () => {
    invertActive = !invertActive;
    invertBtn.classList.toggle("active");

    const viewport = cornerstone.getViewport(element);
    viewport.invert = !viewport.invert;
    cornerstone.setViewport(element, viewport);
  });
}



//CROSSHAIR TOOL (Anclaje con clic sobre la imagen)

function setupCrosshairTool(element: HTMLElement) {
  const crosshairBtn = document.getElementById("crosshairBtn") as HTMLButtonElement;
  let crosshairActive = false;
  let fixedPoint: { x: number; y: number } | null = null;

  // 🔘 Activar / desactivar la herramienta
  crosshairBtn?.addEventListener("click", () => {
    crosshairActive = !crosshairActive;
    crosshairBtn.classList.toggle("active");
    element.style.cursor = crosshairActive ? "crosshair" : "default";

    // 🧹 Al desactivar, limpiar la cruz
    if (!crosshairActive) {
      fixedPoint = null;
      cornerstone.updateImage(element);
    }
  });

  //Fijar punto con clic único
  element.addEventListener("click", (e: MouseEvent) => {
    if (!crosshairActive) return;
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    fixedPoint = { x: coords.x, y: coords.y };
    cornerstone.updateImage(element);
  });

  //Dibujar cruz fija sobre el punto seleccionado
  element.addEventListener("cornerstoneimagerendered", (evt: any) => {
    if (!crosshairActive || !fixedPoint) return;

    const context = evt.detail.canvasContext.canvas.getContext("2d");
    const { x, y } = cornerstone.pixelToCanvas(element, fixedPoint);
    const canvas = evt.detail.canvasContext.canvas;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.strokeStyle = "rgba(0, 255, 0, 0.9)"; // verde clínico
    context.lineWidth = 1.5;

    // ➕ Líneas cruzadas
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();

    context.restore();
  });
}


// ROTATE TOOL 

function setupRotateTool(element: HTMLElement) {
  const bindRotate = () => {
    const rotateBtn = document.getElementById("rotateBtn") as HTMLButtonElement | null;
    if (!rotateBtn) {
      console.warn("RotateTool: botón #rotateBtn no encontrado todavía. Reintentando en DOMContentLoaded…");
      return false;
    }

    let rotateActive = false;
    let lastX: number | null = null;

    rotateBtn.addEventListener("click", () => {
      rotateActive = !rotateActive;
      rotateBtn.classList.toggle("active", rotateActive);
      element.style.cursor = rotateActive ? "grab" : "default";
      if (!rotateActive) lastX = null;
      console.log(`RotateTool: ${rotateActive ? "ACTIVA" : "INACTIVA"}`);
    });

    element.addEventListener("mousedown", (e: MouseEvent) => {
      if (!rotateActive) return;
      lastX = e.clientX;
      element.style.cursor = "grabbing";
    });

    element.addEventListener("mousemove", (e: MouseEvent) => {
      if (!rotateActive || lastX === null) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;

      const viewport = cornerstone.getViewport(element);
      if (!viewport) return;

      const sensitivity = 0.4; // ajusta si quieres más/menos “suave”
      viewport.rotation = (viewport.rotation + dx * sensitivity) % 360;
      cornerstone.setViewport(element, viewport);
    });

    element.addEventListener("mouseup", () => {
      if (!rotateActive) return;
      lastX = null;
      element.style.cursor = "grab";
    });

    console.log("RotateTool: listeners vinculados");
    return true;
  };

  // Intento inmediato
  const okNow = bindRotate();
  if (okNow) return;

  // Fallback: si aún no existe el botón, nos suscribimos a DOMContentLoaded
  const onReady = () => {
    if (bindRotate()) {
      document.removeEventListener("DOMContentLoaded", onReady);
    }
  };
  document.addEventListener("DOMContentLoaded", onReady);
}






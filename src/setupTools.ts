// setupTools.ts

//Imports de Cornerstone
import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";
import * as dicomParser from "dicom-parser";
import Hammer from "hammerjs";

//Imports del gestor global de herramientas
import { registerTool, activateTool } from "./Tools/toolStateManager";

//Imports de tus herramientas ROI (etiquetado)
import { setupPointTool } from "./Tools/PointTool";
import { setupRulerTool } from "./Tools/RulerTool";
import { setupEllipseTool } from "./Tools/EllipseTool";
import { setupRectangleTool } from "./Tools/RectangleTool";
import { setupFreeHandTool } from "./Tools/FreeHandTool";
import { setupArrowTool } from "./Tools/ArrowTool";

// Dependencias Externas
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;
cornerstoneTools.external.dicomParser = dicomParser;

// Inicialización global de Cornerstone Tools
cornerstoneTools.init();


// Estilos globales

// 1) Fuente de texto
if (cornerstoneTools?.textStyle?.setFont) {
  cornerstoneTools.textStyle.setFont("13px Arial");
} else if (cornerstoneTools?.store) {
  cornerstoneTools.store.state = cornerstoneTools.store.state || {};
  cornerstoneTools.store.state.textStyle = {
    ...(cornerstoneTools.store.state.textStyle || {}),
    font: "13px Arial",
    color: "rgb(0,255,0)",
    background: "rgba(0,0,0,0.7)",
  };
}

// 2) Colores/anchos de herramienta
if (cornerstoneTools?.toolStyle?.setToolWidth) {
  cornerstoneTools.toolStyle.setToolWidth(2);
}
if (cornerstoneTools?.toolStyle?.setToolColor) {
  cornerstoneTools.toolStyle.setToolColor("rgb(200,200,200)");
}
if (cornerstoneTools?.toolStyle?.setActiveColor) {
  cornerstoneTools.toolStyle.setActiveColor("rgb(0,255,0)");
}

// 3) Handles (puntos de control)
if (cornerstoneTools?.toolStyle?.setHandleRadius) {
  cornerstoneTools.toolStyle.setHandleRadius(6);
}
if (cornerstoneTools?.toolStyle?.setFillColor) {
  cornerstoneTools.toolStyle.setFillColor("rgba(0,255,0,0.25)");
}
if (cornerstoneTools?.toolStyle?.setStrokeColor) {
  cornerstoneTools.toolStyle.setStrokeColor("rgb(0,255,0)");
}

// Fallbacks
if (cornerstoneTools?.store) {
  const st = cornerstoneTools.store.state || (cornerstoneTools.store.state = {});
  st.toolStyle = { ...(st.toolStyle || {}), width: st.toolStyle?.width ?? 2 };
  st.toolColors = {
    ...(st.toolColors || {}),
    defaultColor: st.toolColors?.defaultColor ?? "rgb(200,200,200)",
    activeColor: st.toolColors?.activeColor ?? "rgb(0,255,0)",
  };
  st.handleStyle = {
    ...(st.handleStyle || {}),
    radius: st.handleStyle?.radius ?? 6,
    fill: st.handleStyle?.fill ?? "rgba(0,255,0,0.25)",
    stroke: st.handleStyle?.stroke ?? "rgb(0,255,0)",
  };
}


// setupTools principal

export function setupTools(element: HTMLElement) {
  //Herramientas de visualización
  setupZoomTool(element);
  setupPanTool(element);
  setupWindowLevelTool(element);
  setupInvertTool(element);
  setupCrosshairTool(element);
  setupRotateTool(element);

  //Herramientas de anotación / etiquetado
  setupPointTool(element);
  setupRulerTool(element);
  setupEllipseTool(element);
  setupRectangleTool(element);
  setupFreeHandTool(element);
  setupArrowTool(element);
}


// ZOOM TOOL 

function setupZoomTool(element: HTMLElement) {
  const zoomBtn = document.getElementById("zoomBtn") as HTMLButtonElement;
  let zoomActive = false;
  let dragging = false;
  let lastY = 0;

  registerTool("zoom", () => {
    zoomActive = false;
    dragging = false;
    zoomBtn.classList.remove("active");
    element.style.cursor = "default";
  });

  zoomBtn?.addEventListener("click", () => {
    if (!zoomActive) {
      activateTool("zoom");
      zoomActive = true;
      zoomBtn.classList.add("active");
      element.style.cursor = "ns-resize";
    } else {
      zoomActive = false;
      zoomBtn.classList.remove("active");
      element.style.cursor = "default";
    }
  });

  element.addEventListener("mousedown", (e: MouseEvent) => {
    if (!zoomActive || e.button !== 0) return;
    dragging = true;
    lastY = e.clientY;
  });

  element.addEventListener("mousemove", (e: MouseEvent) => {
    if (!zoomActive || !dragging) return;
    const deltaY = e.clientY - lastY;
    lastY = e.clientY;
    const viewport = cornerstone.getViewport(element);
    const zoomFactor = deltaY < 0 ? 1.05 : 0.95;
    viewport.scale *= zoomFactor;
    cornerstone.setViewport(element, viewport);
  });

  element.addEventListener("mouseup", () => (dragging = false));
  element.addEventListener("mouseleave", () => (dragging = false));
}


// PAN TOOL

function setupPanTool(element: HTMLElement) {
  const panBtn = document.getElementById("panBtn") as HTMLButtonElement;
  let panActive = false;
  let lastPos: { x: number; y: number } | null = null;

  registerTool("pan", () => {
    panActive = false;
    panBtn.classList.remove("active");
    element.style.cursor = "default";
  });

  panBtn?.addEventListener("click", () => {
    if (!panActive) {
      activateTool("pan");
      panActive = true;
      panBtn.classList.add("active");
      element.style.cursor = "grab";
    } else {
      panActive = false;
      panBtn.classList.remove("active");
      element.style.cursor = "default";
    }
  });

  element.addEventListener("mousedown", (e: MouseEvent) => {
    if (!panActive) return;
    lastPos = { x: e.clientX, y: e.clientY };
    element.style.cursor = "grabbing";
  });

  element.addEventListener("mousemove", (e: MouseEvent) => {
    if (!panActive || !lastPos) return;
    const viewport = cornerstone.getViewport(element);
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    viewport.translation.x += dx / viewport.scale;
    viewport.translation.y += dy / viewport.scale;
    cornerstone.setViewport(element, viewport);
    lastPos = { x: e.clientX, y: e.clientY };
  });

  element.addEventListener("mouseup", () => (lastPos = null));
  element.addEventListener("mouseleave", () => (lastPos = null));
}


// WINDOW WIDTH / LEVEL TOOL (con botón)

function setupWindowLevelTool(element: HTMLElement) {
  const windowBtn = document.getElementById("windowBtn") as HTMLButtonElement;
  let windowActive = false;

  let ww = 1200;
  let wc = 600;
  let wwHudTimeout: any = null;

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

  registerTool("window", () => {
    windowActive = false;
    windowBtn.classList.remove("active");
    element.style.cursor = "default";
  });

  windowBtn?.addEventListener("click", () => {
    if (!windowActive) {
      activateTool("window");
      windowActive = true;
      windowBtn.classList.add("active");
      element.style.cursor = "col-resize";
    } else {
      windowActive = false;
      windowBtn.classList.remove("active");
      element.style.cursor = "default";
    }
  });

  element.addEventListener("wheel", (e: WheelEvent) => {
    if (!windowActive) return;
    e.preventDefault();
    const step = e.deltaY * -0.25;
    ww += step;
    wc -= step * 0.5;
    ww = Math.max(100, Math.min(4095, ww));
    wc = Math.max(-500, Math.min(4500, wc));
    updateWWWC();
  });

  element.addEventListener("dblclick", () => {
    if (!windowActive) return;
    ww = 1200;
    wc = 600;
    updateWWWC();
  });
}


// INVERT TOOL

function setupInvertTool(element: HTMLElement) {
  const invertBtn = document.getElementById("invertBtn") as HTMLButtonElement;
  let invertActive = false;

  registerTool("invert", () => {
    invertActive = false;
    invertBtn.classList.remove("active");
  });

  invertBtn?.addEventListener("click", () => {
    if (!invertActive) {
      activateTool("invert");
      invertActive = true;
      invertBtn.classList.add("active");
      const viewport = cornerstone.getViewport(element);
      viewport.invert = !viewport.invert;
      cornerstone.setViewport(element, viewport);
    } else {
      invertActive = false;
      invertBtn.classList.remove("active");
    }
  });
}


// CROSSHAIR TOOL

function setupCrosshairTool(element: HTMLElement) {
  const crosshairBtn = document.getElementById("crosshairBtn") as HTMLButtonElement;
  let crosshairActive = false;
  let fixedPoint: { x: number; y: number } | null = null;

  registerTool("crosshair", () => {
    crosshairActive = false;
    fixedPoint = null;
    crosshairBtn.classList.remove("active");
    element.style.cursor = "default";
    cornerstone.updateImage(element);
  });

  crosshairBtn?.addEventListener("click", () => {
    if (!crosshairActive) {
      activateTool("crosshair");
      crosshairActive = true;
      crosshairBtn.classList.add("active");
      element.style.cursor = "crosshair";
    } else {
      crosshairActive = false;
      fixedPoint = null;
      crosshairBtn.classList.remove("active");
      element.style.cursor = "default";
      cornerstone.updateImage(element);
    }
  });

  element.addEventListener("click", (e: MouseEvent) => {
    if (!crosshairActive) return;
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    fixedPoint = { x: coords.x, y: coords.y };
    cornerstone.updateImage(element);
  });

  element.addEventListener("cornerstoneimagerendered", (evt: any) => {
    if (!crosshairActive || !fixedPoint) return;
    const ctx = evt.detail.canvasContext.canvas.getContext("2d");
    const { x, y } = cornerstone.pixelToCanvas(element, fixedPoint);
    const canvas = evt.detail.canvasContext.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "rgba(0,255,0,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    ctx.restore();
  });
}


// ROTATE TOOL

function setupRotateTool(element: HTMLElement) {
  const rotateBtn = document.getElementById("rotateBtn") as HTMLButtonElement;
  let rotateActive = false;
  let lastX: number | null = null;

  registerTool("rotate", () => {
    rotateActive = false;
    lastX = null;
    rotateBtn.classList.remove("active");
    element.style.cursor = "default";
  });

  rotateBtn?.addEventListener("click", () => {
    if (!rotateActive) {
      activateTool("rotate");
      rotateActive = true;
      rotateBtn.classList.add("active");
      element.style.cursor = "grab";
    } else {
      rotateActive = false;
      rotateBtn.classList.remove("active");
      element.style.cursor = "default";
    }
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
    const sensitivity = 0.4;
    viewport.rotation = (viewport.rotation + dx * sensitivity) % 360;
    cornerstone.setViewport(element, viewport);
  });

  element.addEventListener("mouseup", () => (lastX = null));
  element.addEventListener("mouseleave", () => (lastX = null));
}







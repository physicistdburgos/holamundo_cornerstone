// POINT TOOL

import * as cornerstone from "cornerstone-core";
import { registerTool, activateTool } from "./toolStateManager";

export function setupPointTool(element: HTMLElement) {
  const pointBtn = document.getElementById("pointBtn") as HTMLButtonElement;
  let pointActive = false;

  // Lista de puntos
  let points: { x: number; y: number }[] = [];
  let hoveredIndex: number | null = null;

  // Temporizador para distinguir clic de doble clic
  let clickTimer: number | null = null;

  
  // Render permanente (persistencia del dibujo)
  
  element.addEventListener("cornerstoneimagerendered", drawPoints);

  
  // Registro global
  
  registerTool("point", () => {
    pointActive = false;
    pointBtn.classList.remove("active");
    (element as HTMLDivElement).style.cursor = "default";

    // 🔸 El render permanece, se eliminan solo los eventos interactivos
    element.removeEventListener("click", onClick, true);
    element.removeEventListener("dblclick", onDblClick, true);
    element.removeEventListener("mousemove", onMouseMove, true);

    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
  });

  
  // Dibujo (verde activo / gris inactivo)
  
  function drawPoints(evt: any) {
    const ctx = evt.detail.canvasContext.canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.lineWidth = 2;
    ctx.font = "12px Arial";

    points.forEach((p, i) => {
      const c = cornerstone.pixelToCanvas(element, p);
      const r = 8;

      // Determinar color del punto según estado
      let color = "#CCCCCC"; // gris por defecto (inactivo)
      if (pointActive) {
        color = i === hoveredIndex ? "#00FF00" : "#00FF00"; // siempre verde cuando activo
      }

      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillText(`${i + 1}`, c.x + 10, c.y + 4);
    });

    ctx.restore();
  }

  
  // Detectar hover sobre puntos
  
  function onMouseMove(e: MouseEvent) {
    if (!pointActive) {
      hoveredIndex = null;
      cornerstone.updateImage(element);
      return;
    }

    const imgPt = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, imgPt);

    hoveredIndex = null;
    for (let i = 0; i < points.length; i++) {
      const pCanvas = cornerstone.pixelToCanvas(element, points[i]);
      const dist = Math.hypot(pCanvas.x - clickCanvas.x, pCanvas.y - clickCanvas.y);
      if (dist <= 10) {
        hoveredIndex = i;
        break;
      }
    }

    cornerstone.updateImage(element);
  }

  
  // Clic simple → Crear punto
  
  function onClick(e: MouseEvent) {
    if (!pointActive) return;
    if (e.button !== 0) return;
    if (clickTimer) return;

    clickTimer = window.setTimeout(() => {
      const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      points.push({ x: coords.x, y: coords.y });
      cornerstone.updateImage(element);
      clickTimer = null;
    }, 220);
  }

  
  // Doble clic → Eliminar punto más cercano
  
  function onDblClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }

    if (points.length === 0) return;

    const imgPt = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, imgPt);

    const distances = points.map((p) => {
      const pc = cornerstone.pixelToCanvas(element, p);
      return Math.hypot(pc.x - clickCanvas.x, pc.y - clickCanvas.y);
    });

    const minDist = Math.min(...distances);
    const idx = distances.indexOf(minDist);

    if (minDist <= 15 && idx > -1) {
      points.splice(idx, 1);
      cornerstone.updateImage(element);
    }
  }

  
  // Activar / desactivar herramienta
  
  pointBtn.addEventListener("click", () => {
    if (!pointActive) {
      activateTool("point");

      // (Render permanente) — solo listeners interactivos
      element.addEventListener("click", onClick, true);
      element.addEventListener("dblclick", onDblClick, true);
      element.addEventListener("mousemove", onMouseMove, true);

      pointBtn.classList.add("active");
      (element as HTMLDivElement).style.cursor = "crosshair";
      pointActive = true;
    } else {
      pointActive = false;
      pointBtn.classList.remove("active");
      (element as HTMLDivElement).style.cursor = "default";

      element.removeEventListener("click", onClick, true);
      element.removeEventListener("dblclick", onDblClick, true);
      element.removeEventListener("mousemove", onMouseMove, true);

      hoveredIndex = null;

      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      cornerstone.updateImage(element);
    }
  });
}



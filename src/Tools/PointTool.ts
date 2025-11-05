// src/Tools/PointTool.ts

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";

export function setupPointTool(element: HTMLElement) {
   
    // Herramienta de Punto 
   
    const pointBtn = document.getElementById("pointBtn") as HTMLButtonElement;
    let pointActive = false;
    
    // Puntos guardados en coordenadas de imagen
    let points: { x: number; y: number }[] = [];
    
    // Temporizador para distinguir click simple de doble click
    let clickTimer: number | null = null;
    
    // Dibujo de puntos (contorno, numerados)
    function drawPoints(evt: any) {
      const ctx = evt.detail.canvasContext.canvas.getContext("2d");
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.fillStyle = "yellow";
      ctx.font = "12px Arial";
    
      points.forEach((p, i) => {
        const c = cornerstone.pixelToCanvas(element, p);
        const r = 8;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillText(`${i + 1}`, c.x + 10, c.y + 4);
      });
    
      ctx.restore();
    }
    
    // CLICK: crea punto solo si NO hay doble clic (se decide tras 220 ms)
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return; // solo botón izquierdo
      // Si ya hay un temporizador, significa que este es el 2º click; no crear punto aquí
      if (clickTimer) return;
    
      clickTimer = window.setTimeout(() => {
        // click simple confirmado: crear punto
        const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
        points.push({ x: coords.x, y: coords.y });
        cornerstone.updateImage(element);
        clickTimer = null;
      }, 220); // ventana para detectar doble clic
    }
    
    // DBLCLICK: borrar el punto más cercano y cancelar creación del click simple
    function onDblClick(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
    
      // Cancela posible creación del click simple pendiente
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
    
      if (points.length === 0) return;
    
      // Coordenadas del doble clic en imagen
      const imgPt = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      const clickCanvas = cornerstone.pixelToCanvas(element, imgPt);
    
      // Buscar punto más cercano en coordenadas de canvas
      const distances = points.map((p) => {
        const pc = cornerstone.pixelToCanvas(element, p);
        return Math.hypot(pc.x - clickCanvas.x, pc.y - clickCanvas.y);
      });
    
      const minDist = Math.min(...distances);
      const idx = distances.indexOf(minDist);
    
      // Umbral de 15 px alrededor del contorno
      if (minDist <= 15 && idx > -1) {
        points.splice(idx, 1);
        cornerstone.updateImage(element);
      }
    }
    
    // Activar / desactivar herramienta
    pointBtn.addEventListener("click", () => {
      if (!pointActive) {
        element.addEventListener("cornerstoneimagerendered", drawPoints);
        element.addEventListener("click", onClick, true);     // capture = true ayuda con timing
        element.addEventListener("dblclick", onDblClick, true);
        pointBtn.classList.add("active");
        (element as HTMLDivElement).style.cursor = "crosshair";
        pointActive = true;
      } else {
        element.removeEventListener("cornerstoneimagerendered", drawPoints);
        element.removeEventListener("click", onClick, true);
        element.removeEventListener("dblclick", onDblClick, true);
        pointBtn.classList.remove("active");
        (element as HTMLDivElement).style.cursor = "default";
        pointActive = false;
    
        // Limpia cualquier temporizador pendiente
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
      }
    });
    
    }
// FREEHAND ROI TOOL

import * as cornerstone from "cornerstone-core";
import { registerTool, activateTool } from "./toolStateManager";

export function setupFreeHandTool(element: HTMLElement) {
  const freehandBtn = document.getElementById("freehandBtn") as HTMLButtonElement;

  let freehandActive = false;
  let drawing = false;
  let movingROI = false;
  let movingLabel = false;

  let selectedROI: any = null;
  let hoveredROI: any = null;
  let lastMovePixel: { x: number; y: number } | null = null;
  let offsetLabelX = 0;
  let offsetLabelY = 0;

  let currentPath: { x: number; y: number }[] = [];

  let freehandROIs: {
    id: number;
    points: { x: number; y: number }[];
    stats?: { area: number; mean: number; std: number };
    labelPos: { x: number; y: number };
  }[] = [];

  const colorActive = "#00FF00";
  const colorInactive = "#CCCCCC";

 
  // Render permanente (dibujo persistente)
 
  element.addEventListener("cornerstoneimagerendered", drawFreehand);

  
  // Registro global en toolStateManager
 
  registerTool("freehand", () => {
    freehandActive = false;
    freehandBtn.classList.remove("active");
    element.style.cursor = "default";

    // Desactivar completamente listeners interactivos
    element.removeEventListener("mousemove", handleMouseMoveHover);
    element.removeEventListener("mousedown", startAction);
    element.removeEventListener("mouseup", endAction);
    element.removeEventListener("dblclick", deleteROIOnDblClick);

    // Reset de flags temporales
    drawing = false;
    movingROI = false;
    movingLabel = false;
    selectedROI = null;
    lastMovePixel = null;
    currentPath = [];
  });

  
  // Utilidades geométricas
  
  function pointInPolygonCanvas(pt: { x: number; y: number }, polyCanvas: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = polyCanvas.length - 1; i < polyCanvas.length; j = i++) {
      const xi = polyCanvas[i].x,
        yi = polyCanvas[i].y;
      const xj = polyCanvas[j].x,
        yj = polyCanvas[j].y;
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 0.0001) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function closestPointOnSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby || 0.0001;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * abx;
    const qy = ay + t * aby;
    return { x: qx, y: qy, dist2: (px - qx) ** 2 + (py - qy) ** 2 };
  }

  function closestPointOnPolygonToLabel(polyCanvas: { x: number; y: number }[], label: { x: number; y: number }) {
    if (polyCanvas.length === 0) return { x: label.x, y: label.y };
    let best = { x: polyCanvas[0].x, y: polyCanvas[0].y, dist2: Infinity };
    for (let i = 0; i < polyCanvas.length; i++) {
      const a = polyCanvas[i];
      const b = polyCanvas[(i + 1) % polyCanvas.length];
      const cand = closestPointOnSegment(a.x, a.y, b.x, b.y, label.x, label.y);
      if (cand.dist2 < best.dist2) best = cand;
    }
    return { x: best.x, y: best.y };
  }

  
  // Cálculo de estadísticas
 
  function calculateStats(points: { x: number; y: number }[]) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    area = Math.abs(area / 2);

    let sx = 1,
      sy = 1;
    try {
      const imagePlane = cornerstone.metaData.get("imagePlaneModule", element);
      if (imagePlane && Array.isArray(imagePlane.pixelSpacing)) {
        [sx, sy] = imagePlane.pixelSpacing.map(Number);
      }
    } catch {
      sx = sy = 1;
    }

    const image = cornerstone.getImage(element);
    const pixelData = image.getPixelData();
    const width = image.width;
    const height = image.height;

    const areaMM2 = area * sx * sy;

    const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));

    const values: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygonCanvas({ x, y }, points)) {
          values.push(pixelData[y * width + x]);
        }
      }
    }

    let mean = 0,
      std = 0;
    if (values.length > 0) {
      mean = values.reduce((a, b) => a + b, 0) / values.length;
      std = Math.sqrt(values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length);
    }

    return { area: areaMM2, mean, std };
  }

  
  // Dibujo persistente
  
  function drawFreehand(evt: any) {
    const ctx = evt.detail.canvasContext.canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = 2;
    ctx.font = "13px Arial";

    freehandROIs.forEach((roi) => {
      const ptsCanvas = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
      const isHovered = hoveredROI && hoveredROI.id === roi.id;
      ctx.strokeStyle = isHovered ? colorActive : colorInactive;
      ctx.fillStyle = isHovered ? colorActive : colorInactive;

      if (ptsCanvas.length > 1) {
        ctx.beginPath();
        ptsCanvas.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }

      if (isHovered) {
        const r = 4;
        ptsCanvas.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
          ctx.stroke();
        });
      }

      if (roi.stats) {
        const label = roi.labelPos;
        const lines = [
          `Area: ${roi.stats.area.toFixed(1)} mm²`,
          `Mean: ${roi.stats.mean.toFixed(1)}`,
          `Std: ${roi.stats.std.toFixed(1)}`,
        ];
        const anchor = closestPointOnPolygonToLabel(ptsCanvas, label);

        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(label.x - 5, label.y - 10);
        ctx.stroke();
        ctx.setLineDash([]);
        lines.forEach((t, i) => ctx.fillText(t, label.x, label.y + i * 15));
      }
    });

    if (drawing && currentPath.length > 1) {
      const pts = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
      ctx.strokeStyle = colorActive;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    ctx.restore();
  }

  
  // Eventos principales
  
  function handleMouseMoveHover(e: MouseEvent) {
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);

    hoveredROI =
      freehandROIs.find((roi) => {
        const ptsCanvas = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
        const overROI = pointInPolygonCanvas(canvasPt, ptsCanvas);
        const lab = roi.labelPos;
        const overLabel = Math.abs(lab.x - canvasPt.x) < 100 && Math.abs(lab.y - canvasPt.y) < 40;
        return overROI || overLabel;
      }) || null;

    cornerstone.updateImage(element);
  }

  function startAction(e: MouseEvent) {
    if (!freehandActive) return;

    if (hoveredROI) {
      selectedROI = hoveredROI;
      const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      const canvasPt = cornerstone.pixelToCanvas(element, pixel);
      const label = selectedROI.labelPos;
      const labelHit = Math.abs(label.x - canvasPt.x) < 100 && Math.abs(label.y - canvasPt.y) < 40;

      if (labelHit) {
        movingLabel = true;
        offsetLabelX = canvasPt.x - label.x;
        offsetLabelY = canvasPt.y - label.y;
      } else {
        movingROI = true;
        lastMovePixel = pixel;
      }
    } else {
      drawing = true;
      currentPath = [cornerstone.pageToPixel(element, e.clientX, e.clientY)];
    }

    element.addEventListener("mousemove", continueAction);
  }

  function continueAction(e: MouseEvent) {
    if (!drawing && !movingROI && !movingLabel) return;

    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);

    if (drawing) {
      currentPath.push(pixel);
      cornerstone.updateImage(element);
    }

    if (movingROI && selectedROI && lastMovePixel) {
      const dx = pixel.x - lastMovePixel.x;
      const dy = pixel.y - lastMovePixel.y;
      selectedROI.points.forEach((p: any) => {
        p.x += dx;
        p.y += dy;
      });
      const prevCanvas = cornerstone.pixelToCanvas(element, lastMovePixel);
      const currCanvas = cornerstone.pixelToCanvas(element, pixel);
      const ddx = currCanvas.x - prevCanvas.x;
      const ddy = currCanvas.y - prevCanvas.y;
      selectedROI.labelPos.x += ddx;
      selectedROI.labelPos.y += ddy;
      lastMovePixel = pixel;
      cornerstone.updateImage(element);
    }

    if (movingLabel && selectedROI) {
      selectedROI.labelPos.x = canvasPt.x - offsetLabelX;
      selectedROI.labelPos.y = canvasPt.y - offsetLabelY;
      cornerstone.updateImage(element);
    }
  }

  function endAction() {
    element.removeEventListener("mousemove", continueAction);

    if (drawing && currentPath.length > 2) {
      const stats = calculateStats(currentPath);
      const ptsCanvas = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
      const maxX = Math.max(...ptsCanvas.map((p) => p.x));
      const minX = Math.min(...ptsCanvas.map((p) => p.x));
      const minY = Math.min(...ptsCanvas.map((p) => p.y));
      const maxY = Math.max(...ptsCanvas.map((p) => p.y));
      const labelPos = { x: maxX + 20, y: (minY + maxY) / 2 - 15 };

      freehandROIs.push({ id: Date.now(), points: [...currentPath], stats, labelPos });
    }

    drawing = false;
    movingROI = false;
    movingLabel = false;
    selectedROI = null;
    lastMovePixel = null;
    currentPath = [];
    cornerstone.updateImage(element);
  }

  function deleteROIOnDblClick(e: MouseEvent) {
    if (!freehandActive || !freehandROIs.length) return;
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);
    const idx = freehandROIs.findIndex((roi) => {
      const ptsCanvas = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
      return pointInPolygonCanvas(canvasPt, ptsCanvas);
    });
    if (idx !== -1) {
      freehandROIs.splice(idx, 1);
      cornerstone.updateImage(element);
    }
  }

  
  // Activar / desactivar herramienta
  
  freehandBtn.addEventListener("click", () => {
    if (!freehandActive) {
      activateTool("freehand");
      freehandActive = true;
      freehandBtn.classList.add("active");
      element.style.cursor = "crosshair";

      element.addEventListener("mousemove", handleMouseMoveHover);
      element.addEventListener("mousedown", startAction);
      element.addEventListener("mouseup", endAction);
      element.addEventListener("dblclick", deleteROIOnDblClick);
    } else {
      freehandActive = false;
      freehandBtn.classList.remove("active");
      element.style.cursor = "default";

      element.removeEventListener("mousemove", handleMouseMoveHover);
      element.removeEventListener("mousedown", startAction);
      element.removeEventListener("mouseup", endAction);
      element.removeEventListener("dblclick", deleteROIOnDblClick);
    }
  });
}



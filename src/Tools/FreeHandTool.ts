// src/Tools/FreeHandTool.ts

// FREEHAND TOOL

import * as cornerstone from "cornerstone-core";

export function setupFreeHandTool(element: HTMLElement) {

const freehandBtn = document.getElementById("freehandBtn") as HTMLButtonElement;
let freehandActive = false;
let drawing = false;
let movingLabel = false;
let selectedROI: any = null;
let offsetX = 0;
let offsetY = 0;

let currentPath: { x: number; y: number }[] = [];
let freehandROIs: {
  id: number;
  points: { x: number; y: number }[];
  stats?: { area: number; mean: number; std: number };
  labelPos: { x: number; y: number };
}[] = [];

// Color único para todas las ROIs
const roiColor = "#00FF00";


// Calcular estadísticas del ROI

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

  area = area * sx * sy;

  const image = cornerstone.getImage(element);
  const pixelData = image.getPixelData();
  const width = image.width;
  const height = image.height;

  const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));

  let values: number[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        if (
          points[i].y > y !== points[j].y > y &&
          x <
            ((points[j].x - points[i].x) * (y - points[i].y)) /
              (points[j].y - points[i].y) +
              points[i].x
        ) {
          inside = !inside;
        }
      }
      if (inside) values.push(pixelData[y * width + x]);
    }
  }

  let mean = 0,
    std = 0;
  if (values.length > 0) {
    mean = values.reduce((a, b) => a + b, 0) / values.length;
    std = Math.sqrt(
      values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
    );
  }

  return { area, mean, std };
}

// Dibujar los ROIs + etiquetas

function drawFreehand(evt: any) {
  const eventData = evt.detail;
  const ctx = eventData.canvasContext.canvas.getContext("2d");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = 2;
  ctx.font = "13px Arial";
  ctx.strokeStyle = roiColor;
  ctx.fillStyle = roiColor;

  freehandROIs.forEach((roi) => {
    const pts = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();

    if (roi.stats) {
      const textLines = [
        `Area: ${roi.stats.area.toFixed(1)} mm²`,
        `Mean: ${roi.stats.mean.toFixed(1)}`,
        `Std Dev: ${roi.stats.std.toFixed(1)}`
      ];

      const labelCanvas = roi.labelPos;

      // Línea guía punteada (como en elipse)
      const maxX = Math.max(...pts.map((p) => p.x));
      const centroidY =
        pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(maxX, centroidY);
      ctx.lineTo(labelCanvas.x - 5, labelCanvas.y - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Texto (alineado a la derecha del ROI)
      textLines.forEach((t, i) => {
        ctx.fillText(t, labelCanvas.x, labelCanvas.y + i * 15);
      });
    }
  });

  // Contorno actual durante el dibujo
  if (drawing && currentPath.length > 1) {
    const pts = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = roiColor;
    ctx.stroke();
  }

  ctx.restore();
}

// Eventos de dibujo

function startDraw(e: MouseEvent) {
  drawing = true;
  currentPath = [];
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  currentPath.push(coords);
  element.addEventListener("mousemove", continueDraw);
}

function continueDraw(e: MouseEvent) {
  if (!drawing) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  currentPath.push(coords);
  cornerstone.updateImage(element);
}

function endDraw() {
  if (drawing && currentPath.length > 2) {
    const stats = calculateStats(currentPath);
    const ptsCanvas = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
    const maxX = Math.max(...ptsCanvas.map((p) => p.x));
    const centroidY = ptsCanvas.reduce((sum, p) => sum + p.y, 0) / ptsCanvas.length;

    // Texto siempre a la derecha del ROI
    const labelPos = { x: maxX + 20, y: centroidY - 15 };

    freehandROIs.push({
      id: Date.now(),
      points: [...currentPath],
      stats,
      labelPos,
    });
  }
  drawing = false;
  currentPath = [];
  element.removeEventListener("mousemove", continueDraw);
  cornerstone.updateImage(element);
}

// Mover texto directamente con clic

function startMoveLabel(e: MouseEvent) {
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  selectedROI = null;
  freehandROIs.forEach((roi) => {
    const label = roi.labelPos;
    const dx = Math.abs(label.x - clickCanvas.x);
    const dy = Math.abs(label.y - clickCanvas.y);
    if (dx < 80 && dy < 30) {
      selectedROI = roi;
      offsetX = clickCanvas.x - label.x;
      offsetY = clickCanvas.y - label.y;
    }
  });

  if (selectedROI) {
    movingLabel = true;
    element.addEventListener("mousemove", moveLabel);
  }
}

function moveLabel(e: MouseEvent) {
  if (!movingLabel || !selectedROI) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);
  selectedROI.labelPos.x = clickCanvas.x - offsetX;
  selectedROI.labelPos.y = clickCanvas.y - offsetY;
  cornerstone.updateImage(element);
}

function endMoveLabel() {
  if (movingLabel) {
    movingLabel = false;
    selectedROI = null;
    element.removeEventListener("mousemove", moveLabel);
  }
}

// Doble clic para eliminar ROI

function deleteNearestROI(e: MouseEvent) {
  if (freehandROIs.length === 0) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  const distances = freehandROIs.map((roi) => {
    const pts = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
    const dists = pts.map((p) => Math.hypot(p.x - clickCanvas.x, p.y - clickCanvas.y));
    return Math.min(...dists);
  });

  const minDist = Math.min(...distances);
  const indexToRemove = distances.indexOf(minDist);

  if (minDist < 15) {
    freehandROIs.splice(indexToRemove, 1);
    cornerstone.updateImage(element);
  }
}

// Activar / desactivar herramienta

freehandBtn.addEventListener("click", () => {
  if (!freehandActive) {
    element.addEventListener("cornerstoneimagerendered", drawFreehand);
    element.addEventListener("mousedown", (e) => {
      // Detecta clic sobre texto o ROI
      const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      const clickCanvas = cornerstone.pixelToCanvas(element, coords);
      const clickedLabel = freehandROIs.find((roi) => {
        const label = roi.labelPos;
        return (
          Math.abs(label.x - clickCanvas.x) < 80 &&
          Math.abs(label.y - clickCanvas.y) < 30
        );
      });

      if (clickedLabel) startMoveLabel(e);
      else startDraw(e);
    });

    element.addEventListener("mouseup", (e) => {
      if (movingLabel) endMoveLabel();
      else endDraw();
    });

    element.addEventListener("dblclick", deleteNearestROI);
    freehandBtn.classList.add("active");
    (element as HTMLDivElement).style.cursor = "crosshair";
    freehandActive = true;
  } else {
    element.removeEventListener("cornerstoneimagerendered", drawFreehand);
    element.removeEventListener("mousedown", startDraw);
    element.removeEventListener("mouseup", endDraw);
    element.removeEventListener("dblclick", deleteNearestROI);
    freehandBtn.classList.remove("active");
    (element as HTMLDivElement).style.cursor = "default";
    freehandActive = false;
  }
});

}
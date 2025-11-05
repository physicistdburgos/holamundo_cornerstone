// src/Tools/RectangleTool.ts

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";

export function setupRectangleTool(element: HTMLElement) {
    
// Herramienta Rectangle ROI 

const rectBtn = document.getElementById("rectBtn") as HTMLButtonElement;
let rectActive = false;
let drawingRect = false;
let movingRectLabel = false;
let selectedRect: any = null;
let offsetRX = 0;
let offsetRY = 0;

// Estructura de los ROIs rectangulares
let rectangles: {
  id: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  stats?: {
    width: number;
    height: number;
    area: number;
    mean: number;
    std: number;
    min: number;
    max: number;
    pixelCount: number;
  };
  labelPos: { x: number; y: number };
}[] = [];

// Color único clínico (verde)
const rectColor = "#00FF00";

// Calcular estadísticas del rectángulo

function calculateRectStats(start: any, end: any) {
  const image = cornerstone.getImage(element);
  const pixelData = image.getPixelData();
  const width = image.width;
  const height = image.height;

  const x1 = Math.floor(Math.min(start.x, end.x));
  const x2 = Math.ceil(Math.max(start.x, end.x));
  const y1 = Math.floor(Math.min(start.y, end.y));
  const y2 = Math.ceil(Math.max(start.y, end.y));

  const roiWidth = x2 - x1;
  const roiHeight = y2 - y1;
  const pixelCount = roiWidth * roiHeight;

  let values: number[] = [];
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      if (x >= 0 && y >= 0 && x < width && y < height) {
        values.push(pixelData[y * width + x]);
      }
    }
  }

  let mean = 0,
    std = 0,
    min = 0,
    max = 0;
  if (values.length > 0) {
    mean = values.reduce((a, b) => a + b, 0) / values.length;
    std = Math.sqrt(
      values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
    );
    min = Math.min(...values);
    max = Math.max(...values);
  }

  // PixelSpacing (mm)
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

  const realWidth = roiWidth * sx;
  const realHeight = roiHeight * sy;
  const area = realWidth * realHeight;

  return {
    width: realWidth,
    height: realHeight,
    area,
    mean,
    std,
    min,
    max,
    pixelCount,
  };
}

// Dibujar rectángulos y etiquetas

function drawRectangles(evt: any) {
  const eventData = evt.detail;
  const ctx = eventData.canvasContext.canvas.getContext("2d");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = 2;
  ctx.font = "13px Arial";
  ctx.strokeStyle = rectColor;
  ctx.fillStyle = rectColor;

  // Dibujar los rectángulos existentes
  rectangles.forEach((rect) => {
    const startCanvas = cornerstone.pixelToCanvas(element, rect.start);
    const endCanvas = cornerstone.pixelToCanvas(element, rect.end);
    const rectWidth = endCanvas.x - startCanvas.x;
    const rectHeight = endCanvas.y - startCanvas.y;

    ctx.strokeStyle = rectColor;
    ctx.strokeRect(startCanvas.x, startCanvas.y, rectWidth, rectHeight);

    if (rect.stats) {
      const lines = [
        `Width: ${rect.stats.width.toFixed(1)} mm`,
        `Height: ${rect.stats.height.toFixed(1)} mm`,
        `Area: ${rect.stats.area.toFixed(1)} mm²`,
        `Mean: ${rect.stats.mean.toFixed(1)}`,
        `Std Dev: ${rect.stats.std.toFixed(1)}`,
        `Min: ${rect.stats.min.toFixed(1)}`,
        `Max: ${rect.stats.max.toFixed(1)}`,
        `Pixel count: ${rect.stats.pixelCount}`,
      ];

      const labelCanvas = rect.labelPos;
      const centerY = startCanvas.y + rectHeight / 2;

      // Línea guía punteada estilo elipse
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(endCanvas.x, centerY);
      ctx.lineTo(labelCanvas.x - 5, labelCanvas.y - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Texto
      lines.forEach((t, i) => {
        ctx.fillText(t, labelCanvas.x, labelCanvas.y + i * 15);
      });
    }
  });

  // Dibujar el rectángulo en curso (dinámico)
  if (drawingRect && rectStart && rectEnd) {
    const startCanvas = cornerstone.pixelToCanvas(element, rectStart);
    const endCanvas = cornerstone.pixelToCanvas(element, rectEnd);
    const rectWidth = endCanvas.x - startCanvas.x;
    const rectHeight = endCanvas.y - startCanvas.y;

    ctx.strokeStyle = rectColor;
    ctx.setLineDash([2, 4]);
    ctx.strokeRect(startCanvas.x, startCanvas.y, rectWidth, rectHeight);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// Eventos de dibujo

let rectStart: any = null;
let rectEnd: any = null;

function startRect(e: MouseEvent) {
  drawingRect = true;
  rectStart = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  rectEnd = { ...rectStart };
  element.addEventListener("mousemove", continueRect);
}

function continueRect(e: MouseEvent) {
  if (!drawingRect) return;
  rectEnd = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  cornerstone.updateImage(element);
}

function endRect() {
  if (drawingRect) {
    const stats = calculateRectStats(rectStart, rectEnd);
    const startCanvas = cornerstone.pixelToCanvas(element, rectStart);
    const endCanvas = cornerstone.pixelToCanvas(element, rectEnd);

    const labelPos = {
      x: Math.max(startCanvas.x, endCanvas.x) + 20,
      y: (startCanvas.y + endCanvas.y) / 2 - 20,
    };

    rectangles.push({
      id: Date.now(),
      start: rectStart,
      end: rectEnd,
      stats,
      labelPos,
    });
  }

  drawingRect = false;
  rectStart = rectEnd = null;
  element.removeEventListener("mousemove", continueRect);
  cornerstone.updateImage(element);
}

// Mover texto con clic directo

function startMoveRectLabel(e: MouseEvent) {
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  selectedRect = null;
  rectangles.forEach((rect) => {
    const label = rect.labelPos;
    const dx = Math.abs(label.x - clickCanvas.x);
    const dy = Math.abs(label.y - clickCanvas.y);
    if (dx < 100 && dy < 40) {
      selectedRect = rect;
      offsetRX = clickCanvas.x - label.x;
      offsetRY = clickCanvas.y - label.y;
    }
  });

  if (selectedRect) {
    movingRectLabel = true;
    element.addEventListener("mousemove", moveRectLabel);
  }
}

function moveRectLabel(e: MouseEvent) {
  if (!movingRectLabel || !selectedRect) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);
  selectedRect.labelPos.x = clickCanvas.x - offsetRX;
  selectedRect.labelPos.y = clickCanvas.y - offsetRY;
  cornerstone.updateImage(element);
}

function endMoveRectLabel() {
  if (movingRectLabel) {
    movingRectLabel = false;
    selectedRect = null;
    element.removeEventListener("mousemove", moveRectLabel);
  }
}

// Doble clic → eliminar rectángulo

function deleteRectROI(e: MouseEvent) {
  if (rectangles.length === 0) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  const indexToRemove = rectangles.findIndex((r) => {
    const start = cornerstone.pixelToCanvas(element, r.start);
    const end = cornerstone.pixelToCanvas(element, r.end);
    return (
      clickCanvas.x >= Math.min(start.x, end.x) &&
      clickCanvas.x <= Math.max(start.x, end.x) &&
      clickCanvas.y >= Math.min(start.y, end.y) &&
      clickCanvas.y <= Math.max(start.y, end.y)
    );
  });

  if (indexToRemove !== -1) {
    rectangles.splice(indexToRemove, 1);
    cornerstone.updateImage(element);
  }
}

// Activar / desactivar herramienta

rectBtn.addEventListener("click", () => {
  if (!rectActive) {
    element.addEventListener("cornerstoneimagerendered", drawRectangles);

    element.addEventListener("mousedown", (e) => {
      const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      const clickCanvas = cornerstone.pixelToCanvas(element, coords);

      const clickedLabel = rectangles.find((r) => {
        const label = r.labelPos;
        return (
          Math.abs(label.x - clickCanvas.x) < 100 &&
          Math.abs(label.y - clickCanvas.y) < 40
        );
      });

      if (clickedLabel) startMoveRectLabel(e);
      else startRect(e);
    });

    element.addEventListener("mouseup", (e) => {
      if (movingRectLabel) endMoveRectLabel();
      else endRect();
    });

    element.addEventListener("dblclick", deleteRectROI);

    rectBtn.classList.add("active");
    (element as HTMLDivElement).style.cursor = "crosshair";
    rectActive = true;
  } else {
    element.removeEventListener("cornerstoneimagerendered", drawRectangles);
    rectBtn.classList.remove("active");
    (element as HTMLDivElement).style.cursor = "default";
    rectActive = false;
  }
});

}
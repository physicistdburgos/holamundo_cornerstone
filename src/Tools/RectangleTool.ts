// src/Tools/RectangleTool.ts

// RECTANGLE ROOL 

import * as cornerstone from "cornerstone-core";

export function setupRectangleTool(element: HTMLElement) {
  const rectBtn = document.getElementById("rectBtn") as HTMLButtonElement;
  let rectActive = false;

  let drawingRect = false;
  let movingRect = false;
  let movingLabel = false;

  let selectedRect: any = null;
  let hoveredRect: any = null;
  let offsetX = 0;
  let offsetY = 0;
  let offsetLabelX = 0;
  let offsetLabelY = 0;

  let rectStart: any = null;
  let rectEnd: any = null;

  // Lista de ROIs
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
    };
    labelPos: { x: number; y: number };
  }[] = [];

  const colorActive = "#00FF00"; // Verde
  const colorInactive = "#CCCCCC"; // Gris claro

  // ---- Calcular estadísticas ----
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

    let values: number[] = [];
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) {
          values.push(pixelData[y * width + x]);
        }
      }
    }

    let mean = 0,
      std = 0;
    if (values.length > 0) {
      mean = values.reduce((a, b) => a + b, 0) / values.length;
      std = Math.sqrt(
        values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) /
          values.length
      );
    }

    // PixelSpacing
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

    return { width: realWidth, height: realHeight, area, mean, std };
  }

  // ---- Dibujo ----
  function drawRectangles(evt: any) {
    const eventData = evt.detail;
    const ctx = eventData.canvasContext.canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = 2;
    ctx.font = "13px Arial";

    rectangles.forEach((rect) => {
      const startCanvas = cornerstone.pixelToCanvas(element, rect.start);
      const endCanvas = cornerstone.pixelToCanvas(element, rect.end);
      const rectWidth = endCanvas.x - startCanvas.x;
      const rectHeight = endCanvas.y - startCanvas.y;

      const isHovered = hoveredRect && hoveredRect.id === rect.id;
      ctx.strokeStyle = isHovered ? colorActive : colorInactive;
      ctx.fillStyle = isHovered ? colorActive : colorInactive;

      // Rectángulo principal
      ctx.strokeRect(startCanvas.x, startCanvas.y, rectWidth, rectHeight);

      // Handles (solo contorno)
      const handleSize = 5;
      const corners = [
        { x: startCanvas.x, y: startCanvas.y },
        { x: endCanvas.x, y: startCanvas.y },
        { x: startCanvas.x, y: endCanvas.y },
        { x: endCanvas.x, y: endCanvas.y },
      ];
      ctx.lineWidth = 1.5;
      corners.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, handleSize, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Etiquetas y línea punteada dinámica
      if (rect.stats) {
        const lines = [
          `Width: ${rect.stats.width.toFixed(1)} mm`,
          `Height: ${rect.stats.height.toFixed(1)} mm`,
          `Area: ${rect.stats.area.toFixed(1)} mm²`,
          `Mean: ${rect.stats.mean.toFixed(1)}`,
          `Std: ${rect.stats.std.toFixed(1)}`,
        ];
        const label = rect.labelPos;

        // Calcular punto más cercano del borde del ROI hacia el texto
        const rectCenterX = startCanvas.x + rectWidth / 2;
        const rectCenterY = startCanvas.y + rectHeight / 2;

        const dx = label.x - rectCenterX;
        const dy = label.y - rectCenterY;

        let anchorX = rectCenterX;
        let anchorY = rectCenterY;

        if (Math.abs(dx) > Math.abs(dy)) {
          // Texto a izquierda o derecha
          anchorX =
            dx > 0 ? startCanvas.x + rectWidth : startCanvas.x;
          anchorY = Math.min(
            Math.max(label.y, startCanvas.y),
            endCanvas.y
          );
        } else {
          // Texto arriba o abajo
          anchorY =
            dy > 0 ? startCanvas.y + rectHeight : startCanvas.y;
          anchorX = Math.min(
            Math.max(label.x, startCanvas.x),
            endCanvas.x
          );
        }

        // Línea guía punteada
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(label.x - 5, label.y - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Texto
        lines.forEach((t, i) => {
          ctx.fillText(t, label.x, label.y + i * 15);
        });
      }
    });

    // Rectángulo dinámico mientras se dibuja
    if (drawingRect && rectStart && rectEnd) {
      const startCanvas = cornerstone.pixelToCanvas(element, rectStart);
      const endCanvas = cornerstone.pixelToCanvas(element, rectEnd);
      const rectWidth = endCanvas.x - startCanvas.x;
      const rectHeight = endCanvas.y - startCanvas.y;

      ctx.strokeStyle = colorActive;
      ctx.setLineDash([3, 4]);
      ctx.strokeRect(startCanvas.x, startCanvas.y, rectWidth, rectHeight);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // ---- Hover detection (ROI o texto) ----
  function handleMouseMoveHover(e: MouseEvent) {
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, coords);

    hoveredRect =
      rectangles.find((r) => {
        const s = cornerstone.pixelToCanvas(element, r.start);
        const en = cornerstone.pixelToCanvas(element, r.end);
        const label = r.labelPos;
        const isOverROI =
          clickCanvas.x >= Math.min(s.x, en.x) &&
          clickCanvas.x <= Math.max(s.x, en.x) &&
          clickCanvas.y >= Math.min(s.y, en.y) &&
          clickCanvas.y <= Math.max(s.y, en.y);
        const isOverLabel =
          Math.abs(label.x - clickCanvas.x) < 100 &&
          Math.abs(label.y - clickCanvas.y) < 40;
        return isOverROI || isOverLabel;
      }) || null;

    cornerstone.updateImage(element);
  }

  // ---- Iniciar acción ----
  function startRect(e: MouseEvent) {
    if (hoveredRect) {
      const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      const clickCanvas = cornerstone.pixelToCanvas(element, coords);
      const label = hoveredRect.labelPos;
      const labelHit =
        Math.abs(label.x - clickCanvas.x) < 100 &&
        Math.abs(label.y - clickCanvas.y) < 40;

      selectedRect = hoveredRect;

      if (labelHit) {
        movingLabel = true;
        offsetLabelX = clickCanvas.x - label.x;
        offsetLabelY = clickCanvas.y - label.y;
      } else {
        movingRect = true;
        offsetX = coords.x - selectedRect.start.x;
        offsetY = coords.y - selectedRect.start.y;
      }
    } else {
      drawingRect = true;
      rectStart = cornerstone.pageToPixel(element, e.clientX, e.clientY);
      rectEnd = { ...rectStart };
    }

    element.addEventListener("mousemove", continueRect);
  }

  function continueRect(e: MouseEvent) {
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);

    if (drawingRect) {
      rectEnd = coords;
      cornerstone.updateImage(element);
    }

    if (movingRect && selectedRect) {
      const dx = coords.x - offsetX;
      const dy = coords.y - offsetY;
      const width = selectedRect.end.x - selectedRect.start.x;
      const height = selectedRect.end.y - selectedRect.start.y;

      // Mueve ROI y texto en conjunto
      selectedRect.start.x = dx;
      selectedRect.start.y = dy;
      selectedRect.end.x = dx + width;
      selectedRect.end.y = dy + height;

      const sCanvas = cornerstone.pixelToCanvas(element, { x: dx, y: dy });
      const eCanvas = cornerstone.pixelToCanvas(element, {
        x: dx + width,
        y: dy + height,
      });
      selectedRect.labelPos.x = Math.max(sCanvas.x, eCanvas.x) + 20;
      selectedRect.labelPos.y =
        (sCanvas.y + eCanvas.y) / 2 - 20;

      cornerstone.updateImage(element);
    }

    if (movingLabel && selectedRect) {
      const clickCanvas = cornerstone.pixelToCanvas(element, coords);
      selectedRect.labelPos.x = clickCanvas.x - offsetLabelX;
      selectedRect.labelPos.y = clickCanvas.y - offsetLabelY;
      cornerstone.updateImage(element);
    }
  }

  function endRect(e: MouseEvent) {
    element.removeEventListener("mousemove", continueRect);

    if (drawingRect) {
      const dx = Math.abs(rectEnd.x - rectStart.x);
      const dy = Math.abs(rectEnd.y - rectStart.y);

      if (dx > 3 && dy > 3) {
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
    }

    drawingRect = false;
    movingRect = false;
    movingLabel = false;
    selectedRect = null;
    rectStart = rectEnd = null;
    cornerstone.updateImage(element);
  }

  // ---- Eliminar ROI con doble clic ----
  function deleteRectROI(e: MouseEvent) {
    if (!rectangles.length) return;
    const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const clickCanvas = cornerstone.pixelToCanvas(element, coords);

    const idx = rectangles.findIndex((r) => {
      const s = cornerstone.pixelToCanvas(element, r.start);
      const en = cornerstone.pixelToCanvas(element, r.end);
      return (
        clickCanvas.x >= Math.min(s.x, en.x) &&
        clickCanvas.x <= Math.max(s.x, en.x) &&
        clickCanvas.y >= Math.min(s.y, en.y) &&
        clickCanvas.y <= Math.max(s.y, en.y)
      );
    });

    if (idx !== -1) {
      rectangles.splice(idx, 1);
      cornerstone.updateImage(element);
    }
  }

  // ---- Activar / desactivar herramienta ----
  rectBtn.addEventListener("click", () => {
    if (!rectActive) {
      element.addEventListener("cornerstoneimagerendered", drawRectangles);
      element.addEventListener("mousemove", handleMouseMoveHover);
      element.addEventListener("mousedown", startRect);
      element.addEventListener("mouseup", endRect);
      element.addEventListener("dblclick", deleteRectROI);

      rectBtn.classList.add("active");
      (element as HTMLDivElement).style.cursor = "crosshair";
      rectActive = true;
    } else {
      element.removeEventListener("cornerstoneimagerendered", drawRectangles);
      element.removeEventListener("mousemove", handleMouseMoveHover);
      element.removeEventListener("mousedown", startRect);
      element.removeEventListener("mouseup", endRect);
      element.removeEventListener("dblclick", deleteRectROI);

      rectBtn.classList.remove("active");
      (element as HTMLDivElement).style.cursor = "default";
      rectActive = false;
    }
  });
}




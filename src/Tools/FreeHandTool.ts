// src/Tools/FreeHandTool.ts

// FREEHAND TOOL

import * as cornerstone from "cornerstone-core";

export function setupFreeHandTool(element: HTMLElement) {
  const freehandBtn = document.getElementById("freehandBtn") as HTMLButtonElement;

  let freehandActive = false;

  // Estados
  let drawing = false;
  let movingROI = false;
  let movingLabel = false;

  // Selección / hover / offsets
  let selectedROI: any = null;
  let hoveredROI: any = null;

  let lastMovePixel: { x: number; y: number } | null = null;
  let offsetLabelX = 0;
  let offsetLabelY = 0;

  // Trazo actual durante el dibujo
  let currentPath: { x: number; y: number }[] = [];

  // Lista de ROIs
  let freehandROIs: {
    id: number;
    points: { x: number; y: number }[]; // coords en espacio imagen (pixel)
    stats?: { area: number; mean: number; std: number };
    labelPos: { x: number; y: number }; // coords en canvas (como en Rectangle)
  }[] = [];

  // Colores
  const colorActive = "#00FF00";   // Verde activo/hover
  const colorInactive = "#CCCCCC"; // Gris inactivo

  // ---------- Utilidades geométricas ----------

  function pointInPolygonCanvas(
    pt: { x: number; y: number },
    polyCanvas: { x: number; y: number }[]
  ): boolean {
    // Ray casting
    let inside = false;
    for (let i = 0, j = polyCanvas.length - 1; i < polyCanvas.length; j = i++) {
      const xi = polyCanvas[i].x, yi = polyCanvas[i].y;
      const xj = polyCanvas[j].x, yj = polyCanvas[j].y;

      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x <
          ((xj - xi) * (pt.y - yi)) / (yj - yi + 0.0000001) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function closestPointOnSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number
  ): { x: number; y: number; dist2: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby || 0.0000001;
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * abx;
    const qy = ay + t * aby;
    const dx = px - qx;
    const dy = py - qy;
    return { x: qx, y: qy, dist2: dx * dx + dy * dy };
  }

  function closestPointOnPolygonToLabel(
    polyCanvas: { x: number; y: number }[],
    label: { x: number; y: number }
  ): { x: number; y: number } {
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

  // ---------- Cálculo de estadísticas en espacio imagen ----------

  function calculateStats(points: { x: number; y: number }[]) {
    // Área por fórmula de Shoelace en espacio imagen
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    area = Math.abs(area / 2);

    // PixelSpacing
    let sx = 1, sy = 1;
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

    // Área en mm²
    const areaMM2 = area * sx * sy;

    // Mean / Std sobre píxeles interiores (bounding box + point-in-poly)
    const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));

    // Prepara polígono para test en espacio imagen
    function pointInPolyImage(x: number, y: number): boolean {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersect =
          yi > y !== yj > y &&
          x <
            ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    const values: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolyImage(x, y)) {
          values.push(pixelData[y * width + x]);
        }
      }
    }

    let mean = 0, std = 0;
    if (values.length > 0) {
      mean = values.reduce((a, b) => a + b, 0) / values.length;
      std = Math.sqrt(
        values.map((v) => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
      );
    }

    return { area: areaMM2, mean, std };
  }

  // ---------- Dibujo ----------

  function drawFreehand(evt: any) {
    const eventData = evt.detail;
    const ctx = eventData.canvasContext.canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = 2;
    ctx.font = "13px Arial";

    // ROIs persistidas
    freehandROIs.forEach((roi) => {
      const ptsCanvas = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
      const isHovered = hoveredROI && hoveredROI.id === roi.id;

      // Colores por estado
      ctx.strokeStyle = isHovered ? colorActive : colorInactive;
      ctx.fillStyle = isHovered ? colorActive : colorInactive;

      // Contorno principal
      if (ptsCanvas.length > 1) {
        ctx.beginPath();
        ptsCanvas.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }

      // Handles (vértices) — solo contorno y solo si activo/hover
      if (isHovered && ptsCanvas.length > 0) {
        ctx.lineWidth = 1.5;
        const r = 4;
        ptsCanvas.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
          ctx.stroke();
        });
      }

      // Etiqueta + línea guía dinámica
      if (roi.stats) {
        const label = roi.labelPos; // coords en canvas
        const lines = [
          `Area: ${roi.stats.area.toFixed(1)} mm²`,
          `Mean: ${roi.stats.mean.toFixed(1)}`,
          `Std: ${roi.stats.std.toFixed(1)}`,
        ];

        // Punto del contorno más cercano al label (en canvas)
        const anchor = closestPointOnPolygonToLabel(ptsCanvas, label);

        // Línea punteada
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(label.x - 5, label.y - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Texto
        lines.forEach((t, i) => ctx.fillText(t, label.x, label.y + i * 15));
      }
    });

    // Trazo dinámico mientras se dibuja
    if (drawing && currentPath.length > 1) {
      const pts = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
      ctx.strokeStyle = colorActive;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------- Hover (ROI o label) ----------

  function handleMouseMoveHover(e: MouseEvent) {
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);

    hoveredROI =
      freehandROIs.find((roi) => {
        const ptsCanvas = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
        const overROI = pointInPolygonCanvas(canvasPt, ptsCanvas);

        const lab = roi.labelPos;
        const overLabel =
          Math.abs(lab.x - canvasPt.x) < 100 &&
          Math.abs(lab.y - canvasPt.y) < 40;

        return overROI || overLabel;
      }) || null;

    cornerstone.updateImage(element);
  }

  // ---------- Dibujo de nueva ROI ----------

  function startDraw(e: MouseEvent) {
    drawing = true;
    currentPath = [];
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    currentPath.push(pixel);
    element.addEventListener("mousemove", continueDraw);
  }

  function continueDraw(e: MouseEvent) {
    if (!drawing) return;
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    currentPath.push(pixel);
    cornerstone.updateImage(element);
  }

  function endDraw() {
    element.removeEventListener("mousemove", continueDraw);

    if (drawing && currentPath.length > 2) {
      const stats = calculateStats(currentPath);

      // Label inicialmente a la derecha del bounding box del trazo
      const ptsCanvas = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
      const maxX = Math.max(...ptsCanvas.map((p) => p.x));
      const minX = Math.min(...ptsCanvas.map((p) => p.x));
      const minY = Math.min(...ptsCanvas.map((p) => p.y));
      const maxY = Math.max(...ptsCanvas.map((p) => p.y));
      const labelPos = {
        x: maxX + 20,
        y: (minY + maxY) / 2 - 15,
      };

      freehandROIs.push({
        id: Date.now(),
        points: [...currentPath],
        stats,
        labelPos,
      });
    }

    drawing = false;
    currentPath = [];
    cornerstone.updateImage(element);
  }

  // ---------- Movimiento ROI / Label ----------

  function startAction(e: MouseEvent) {
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);

    if (hoveredROI) {
      selectedROI = hoveredROI;

      // ¿Click sobre label o sobre ROI?
      const lab = selectedROI.labelPos;
      const labelHit =
        Math.abs(lab.x - canvasPt.x) < 100 &&
        Math.abs(lab.y - canvasPt.y) < 40;

      if (labelHit) {
        movingLabel = true;
        offsetLabelX = canvasPt.x - lab.x;
        offsetLabelY = canvasPt.y - lab.y;
      } else {
        movingROI = true;
        lastMovePixel = pixel; // para delta en espacio imagen
      }
    } else {
      // No hay hover → iniciar dibujo
      startDraw(e);
      return;
    }

    element.addEventListener("mousemove", continueAction);
  }

  function continueAction(e: MouseEvent) {
    const pixel = cornerstone.pageToPixel(element, e.clientX, e.clientY);
    const canvasPt = cornerstone.pixelToCanvas(element, pixel);

    if (movingROI && selectedROI && lastMovePixel) {
      // Delta en espacio imagen
      const dx = pixel.x - lastMovePixel.x;
      const dy = pixel.y - lastMovePixel.y;

      // Trasladar todos los puntos de la ROI
      selectedROI.points.forEach((p: { x: number; y: number }) => {
        p.x += dx;
        p.y += dy;
      });

      // Mover el label en el mismo delta pero en espacio canvas:
      // Convertimos el delta de imagen a delta canvas con dos puntos de referencia.
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

    if (drawing) {
      continueDraw(e);
    }
  }

  function endAction() {
    element.removeEventListener("mousemove", continueAction);

    movingROI = false;
    movingLabel = false;
    selectedROI = null;
    lastMovePixel = null;

    if (drawing) {
      endDraw();
    }
  }

  // ---------- Eliminar ROI con doble clic (dentro del polígono) ----------

  function deleteROIOnDblClick(e: MouseEvent) {
    if (!freehandROIs.length) return;
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

  // ---------- Activar / Desactivar herramienta ----------

  freehandBtn.addEventListener("click", () => {
    if (!freehandActive) {
      element.addEventListener("cornerstoneimagerendered", drawFreehand);
      element.addEventListener("mousemove", handleMouseMoveHover);
      element.addEventListener("mousedown", startAction);
      element.addEventListener("mouseup", endAction);
      element.addEventListener("dblclick", deleteROIOnDblClick);

      freehandBtn.classList.add("active");
      (element as HTMLDivElement).style.cursor = "crosshair";
      freehandActive = true;
    } else {
      element.removeEventListener("cornerstoneimagerendered", drawFreehand);
      element.removeEventListener("mousemove", handleMouseMoveHover);
      element.removeEventListener("mousedown", startAction);
      element.removeEventListener("mouseup", endAction);
      element.removeEventListener("dblclick", deleteROIOnDblClick);

      freehandBtn.classList.remove("active");
      (element as HTMLDivElement).style.cursor = "default";
      freehandActive = false;
    }
  });
}

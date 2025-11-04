// src/Tools/setupTools.ts

import * as cornerstone from "cornerstone-core";
import * as cornerstoneTools from "cornerstone-tools";

export function setupTools(element: HTMLElement) {
  
    
  // Herramienta Zoom

  const ZoomTool = cornerstoneTools.ZoomTool;
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.setToolPassiveForElement(element, "Zoom");

  const zoomBtn = document.getElementById("zoomBtn") as HTMLButtonElement;
  let zoomActive = false;

  zoomBtn.addEventListener("click", () => {
    if (!zoomActive) {
      cornerstoneTools.setToolActiveForElement(element, "Zoom", {
        mouseButtonMask: 1,
      });
      zoomBtn.classList.add("active");
      element.style.cursor = "zoom-in";
      zoomActive = true;
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "Zoom");
      zoomBtn.classList.remove("active");
      element.style.cursor = "default";
      zoomActive = false;
    }
  });

  
  //  Herramienta Pan
 
  const PanTool = cornerstoneTools.PanTool;
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.setToolPassiveForElement(element, "Pan");

  const panBtn = document.getElementById("panBtn") as HTMLButtonElement;
  let panActive = false;

  panBtn.addEventListener("click", () => {
    if (!panActive) {
      cornerstoneTools.setToolActiveForElement(element, "Pan", {
        mouseButtonMask: 1,
      });
      panBtn.classList.add("active");
      element.style.cursor = "grab";
      panActive = true;
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "Pan");
      panBtn.classList.remove("active");
      element.style.cursor = "default";
      panActive = false;
    }
  });

  
  // Herramienta de Medir
  
  const LengthTool = cornerstoneTools.LengthTool;
  cornerstoneTools.addTool(LengthTool);
  cornerstoneTools.setToolPassiveForElement(element, "Length");

  const measureBtn = document.getElementById("measureBtn") as HTMLButtonElement;
  let measureActive = false;

  measureBtn.addEventListener("click", () => {
    if (!measureActive) {
      cornerstoneTools.setToolActiveForElement(element, "Length", {
        mouseButtonMask: 1, // clic izquierdo para medir
      });
      measureBtn.classList.add("active");
      element.style.cursor = "crosshair";
      measureActive = true;
    } else {
      cornerstoneTools.setToolPassiveForElement(element, "Length");
      measureBtn.classList.remove("active");
      element.style.cursor = "default";
      measureActive = false;
    }
  });

  
  // Mostrar / Ocultar mediciones
  
  const toggleMeasurementsBtn = document.getElementById(
    "toggleMeasurementsBtn"
  ) as HTMLButtonElement;

  // Guardará temporalmente las mediciones cuando estén ocultas
  let savedLengthData: any[] | null = null;

  toggleMeasurementsBtn.addEventListener("click", () => {
    const state = cornerstoneTools.getToolState(element, "Length");

    if (savedLengthData === null) {
      // Ocultar: guardar y limpiar
      const current = state?.data ?? [];
      if (current.length === 0) return; // no hay nada que ocultar

      // Guardar copia
      savedLengthData = current.map((d: any) => ({ ...d }));

      // Limpiar del visor
      cornerstoneTools.clearToolState(element, "Length");
      cornerstone.updateImage(element);

      toggleMeasurementsBtn.classList.remove("active");
      toggleMeasurementsBtn.textContent = "Medidas OFF";
    } else {
      // Mostrar: restaurar las guardadas
      cornerstoneTools.clearToolState(element, "Length");
      savedLengthData.forEach((d) =>
        cornerstoneTools.addToolState(element, "Length", d)
      );
      savedLengthData = null;
      cornerstone.updateImage(element);

      toggleMeasurementsBtn.classList.add("active");
      toggleMeasurementsBtn.textContent = "Medidas ON";
    }
  });


// Herramienta de Invertir
  
  const invertBtn = document.getElementById("invertBtn") as HTMLButtonElement;
  let inverted = false;

  invertBtn.addEventListener("click", () => {
    // ✅ usamos el parámetro 'element' de la función
    const viewport = cornerstone.getViewport(element);
    viewport.invert = !viewport.invert;
    inverted = viewport.invert;
    cornerstone.setViewport(element, viewport);

    if (inverted) {
      invertBtn.classList.add("active");
      invertBtn.textContent = "Invertido";
    } else {
      invertBtn.classList.remove("active");
      invertBtn.textContent = " Invertir";
    }
  });

  // =============================
// ⭕ Herramienta Elipse ROI (con valores)
// =============================
const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool;
cornerstoneTools.addTool(EllipticalRoiTool);
cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");

const ellipseBtn = document.getElementById("ellipseBtn") as HTMLButtonElement;
let ellipseActive = false;

ellipseBtn.addEventListener("click", () => {
  if (!ellipseActive) {
    // Activar herramienta elipse ROI
    cornerstoneTools.setToolActiveForElement(element, "EllipticalRoi", {
      mouseButtonMask: 1,
    });
    ellipseBtn.classList.add("active");
    element.style.cursor = "crosshair";
    ellipseActive = true;
  } else {
    // Desactivar herramienta
    cornerstoneTools.setToolPassiveForElement(element, "EllipticalRoi");
    ellipseBtn.classList.remove("active");
    element.style.cursor = "default";
    ellipseActive = false;
  }
});


// =============================
// Herramienta de Punto 
// =============================
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

// =============================
// Herramienta Freehand ROI 
// =============================
const freehandBtn = document.getElementById("freehandBtn") as HTMLButtonElement;
let freehandActive = false;
let drawing = false;

// Cada ROI libre se almacena como un conjunto de puntos
let currentPath: { x: number; y: number }[] = [];
let freehandROIs: {
  id: number;
  points: { x: number; y: number }[];
  stats?: { area: number; perimeter: number; mean: number; std: number };
}[] = [];

/**
 * Calcular estadísticas del ROI (geométricas + intensidad)
 */
function calculateStats(points: { x: number; y: number }[]) {
  // --- Geometría básica ---
  let area = 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
    perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
  }
  area = Math.abs(area / 2);

  // --- Obtener PixelSpacing de forma segura ---
  let sx = 1,
    sy = 1;
  try {
    const imagePlane = cornerstone.metaData.get("imagePlaneModule", element);
    if (imagePlane && Array.isArray(imagePlane.pixelSpacing)) {
      [sx, sy] = imagePlane.pixelSpacing.map(Number);
    } else if (typeof imagePlane?.pixelSpacing === "number") {
      sx = sy = Number(imagePlane.pixelSpacing);
    }
  } catch {
    // fallback seguro
    sx = sy = 1;
  }

  // --- Convertir unidades a mm² / mm ---
  area = area * sx * sy;
  perimeter = perimeter * ((sx + sy) / 2);

  // --- Intensidades ---
  const image = cornerstone.getImage(element);
  const pixelData = image.getPixelData();
  const width = image.width;
  const height = image.height;

  const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));

  let values: number[] = [];

  // rasterización simple (ray casting)
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

  return { area, perimeter, mean, std };
}

/**
 * Dibuja todos los ROIs y estadísticas
 */
function drawFreehand(evt: any) {
  const eventData = evt.detail;
  const ctx = eventData.canvasContext.canvas.getContext("2d");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "lime";
  ctx.fillStyle = "rgba(0, 255, 0, 0.15)";
  ctx.font = "12px Arial";
  ctx.fillStyle = "yellow";

  // Dibujar ROIs finalizados
  freehandROIs.forEach((roi) => {
    const pts = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Mostrar estadísticas
    const centroid = pts.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    centroid.x /= pts.length;
    centroid.y /= pts.length;

    if (roi.stats) {
      ctx.fillStyle = "yellow";
      ctx.fillText(
        `A=${roi.stats.area.toFixed(1)}mm² | P=${roi.stats.perimeter.toFixed(
          1
        )}mm | µ=${roi.stats.mean.toFixed(1)} | σ=${roi.stats.std.toFixed(1)}`,
        centroid.x - 60,
        centroid.y
      );
    }
  });

  // Contorno actual (en curso)
  if (drawing && currentPath.length > 1) {
    const pts = currentPath.map((p) => cornerstone.pixelToCanvas(element, p));
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Inicio del trazo libre
 */
function startDraw(e: MouseEvent) {
  drawing = true;
  currentPath = [];
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  currentPath.push(coords);
  element.addEventListener("mousemove", continueDraw);
}

/**
 * Mientras se dibuja
 */
function continueDraw(e: MouseEvent) {
  if (!drawing) return;
  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  currentPath.push(coords);
  cornerstone.updateImage(element);
}

/**
 * Final del trazo
 */
function endDraw() {
  if (drawing && currentPath.length > 2) {
    const stats = calculateStats(currentPath);
    freehandROIs.push({ id: Date.now(), points: [...currentPath], stats });
  }
  drawing = false;
  currentPath = [];
  element.removeEventListener("mousemove", continueDraw);
  cornerstone.updateImage(element);
}

/**
 * Doble clic → elimina el ROI más cercano
 */
function deleteNearestROI(e: MouseEvent) {
  if (freehandROIs.length === 0) return;

  const coords = cornerstone.pageToPixel(element, e.clientX, e.clientY);
  const clickCanvas = cornerstone.pixelToCanvas(element, coords);

  // Distancia mínima desde clic hasta cualquier punto del contorno
  const distances = freehandROIs.map((roi) => {
    const pts = roi.points.map((p) => cornerstone.pixelToCanvas(element, p));
    const dists = pts.map((p) => Math.hypot(p.x - clickCanvas.x, p.y - clickCanvas.y));
    return Math.min(...dists);
  });

  const minDist = Math.min(...distances);
  const indexToRemove = distances.indexOf(minDist);

  if (minDist < 25) {
    freehandROIs.splice(indexToRemove, 1);
    cornerstone.updateImage(element);
  }
}

/**
 * Activar / desactivar herramienta
 */
freehandBtn.addEventListener("click", () => {
  if (!freehandActive) {
    element.addEventListener("cornerstoneimagerendered", drawFreehand);
    element.addEventListener("mousedown", startDraw);
    element.addEventListener("mouseup", endDraw);
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
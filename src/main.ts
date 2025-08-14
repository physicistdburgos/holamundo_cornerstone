import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

// === Enlaces básicos (suficientes para integrar el loader) ===
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// === (Opcional recomendado) Workers + codecs si tus CT están comprimidas ===
// cornerstoneWADOImageLoader.webWorkerManager.initialize({
//   maxWebWorkers: Math.min(2, (navigator.hardwareConcurrency || 2)),
//   startWebWorkersOnDemand: true,
//   webWorkerPath: '/dist/index.worker.min.worker.js', // copiado a public/dist
//   taskConfiguration: {
//     decodeTask: { initializeCodecsOnStartup: true, codecsPath: '/dist', usePDFJS: false },
//   },
// });

console.log("Iniciando aplicación...");

// ---------- Utilidades de ordenación ----------
function toNumber(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toNumberArray(tagObj: any): number[] | undefined {
  const arr = tagObj?.Value;
  if (!Array.isArray(arr) || !arr.length) return undefined;
  const nums = arr.map(Number);
  return nums.every(Number.isFinite) ? nums : undefined;
}
function cross(a: number[], b: number[]) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
}
function dot(a: number[], b: number[]) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

type Entry = {
  sopUID: string;
  hasPixel: boolean;
  instNumber?: number;
  ipp?: number[];          // [x,y,z]
  iopRow?: number[];       // [xr,yr,zr]
  iopCol?: number[];       // [xc,yc,zc]
  posAlongNormal?: number; // proyección de IPP sobre la normal
};

async function init() {
  const baseUrl  = "/dicom-web";
  const studyUID = "1.2.826.0.1.3680043.8.498.48565534201860650768733179605548160981";

  try {
    // 1) Series del estudio ⇒ elegir CT
    const seriesRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series?includefield=00080060,0020000E`);
    const seriesList = await seriesRes.json();
    const ctSeries   = seriesList.find((s: any) => s["00080060"]?.Value?.[0] === "CT");
    if (!ctSeries) throw new Error("No se encontró una serie CT.");
    const seriesUID  = ctSeries["0020000E"].Value[0];

    // 2) Instancias de la serie
    const instRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances`);
    const instList = await instRes.json();
    if (!instList.length) throw new Error("La serie CT no contiene imágenes.");

    // 3) Recolectar metadatos y preparar entradas
    const entries: Entry[] = [];
    for (const inst of instList) {
      const sopUID = inst["00080018"]?.Value?.[0];
      if (!sopUID) continue;

      const metaUrl = `${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/metadata`;
      const metaRes = await fetch(metaUrl);
      const metadata = await metaRes.json();
      if (!Array.isArray(metadata) || metadata.length === 0) continue;

      const t = metadata[0];

      // PixelData presente (BulkDataURI o InlineBinary)
      const pixelDataTag = t["7FE00010"];
      const hasPixel = !!pixelDataTag && (pixelDataTag.BulkDataURI || pixelDataTag.InlineBinary);

      // Orden preferente: InstanceNumber
      const instNumber = toNumber(t["00200013"]?.Value?.[0]);

      // Orden geométrico: IOP + IPP
      const ipp = toNumberArray(t["00200032"]);     // ImagePositionPatient [x,y,z]
      const iop = toNumberArray(t["00200037"]);     // ImageOrientationPatient [xr,yr,zr, xc,yc,zc]
      const iopRow = iop ? iop.slice(0,3) : undefined;
      const iopCol = iop ? iop.slice(3,6) : undefined;

      entries.push({ sopUID, hasPixel, instNumber, ipp, iopRow, iopCol });
    }

    // 4) Filtrar sólo con píxel
    let stack = entries.filter(e => e.hasPixel);
    if (!stack.length) throw new Error("No hay instancias con PixelData (7FE0,0010) accesible por DICOMweb.");

    // 5) Calcular proyección IPP sobre la normal cuando hay IOP
    for (const e of stack) {
      if (e.ipp && e.iopRow && e.iopCol) {
        const normal = cross(e.iopRow, e.iopCol);
        e.posAlongNormal = dot(e.ipp, normal);
      }
    }

    // 6) Ordenar la pila (InstanceNumber → proyección → z → SOPUID)
    const countWithInst = stack.filter(e => e.instNumber !== undefined).length;
    const countWithProj = stack.filter(e => e.posAlongNormal !== undefined).length;
    const countWithZ    = stack.filter(e => e.ipp && Number.isFinite(e.ipp[2])).length;

    if (countWithInst > stack.length * 0.6) {
      stack.sort((a, b) => (a.instNumber! - b.instNumber!));
      console.log("Ordenado por InstanceNumber");
    } else if (countWithProj > stack.length * 0.6) {
      stack.sort((a, b) => (a.posAlongNormal! - b.posAlongNormal!));
      console.log("Ordenado por proyección (IOP·IPP)");
    } else if (countWithZ > stack.length * 0.6) {
      stack.sort((a, b) => ((a.ipp![2]) - (b.ipp![2])));
      console.log("Ordenado por IPP.z (fallback)");
    } else {
      stack.sort((a, b) => a.sopUID.localeCompare(b.sopUID));
      console.warn("Orden fallback por SOPInstanceUID (datos incompletos)");
    }

    const validSOPs = stack.map(e => e.sopUID);
    console.log(`🧩 Pila ordenada, total ${validSOPs.length} imágenes`);

    // 7) Render y navegación
    const element = document.getElementById("dicomImage") as HTMLDivElement;
    cornerstone.enable(element);

    let currentIndex = 0;
    let wheelAttached = false;
    let lastWheelTs = 0;

    // Overlay índice/total
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.right = '8px';
    overlay.style.bottom = '8px';
    overlay.style.padding = '4px 8px';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.color = '#fff';
    overlay.style.font = '12px/1.2 system-ui, sans-serif';
    overlay.style.borderRadius = '6px';
    overlay.style.pointerEvents = 'none';
    element.style.position = 'relative';
    element.appendChild(overlay);

    await loadImage(validSOPs[currentIndex]);

    if (!wheelAttached) {
      wheelAttached = true;

      element.addEventListener("wheel", async (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheelTs < 40) return; // throttle (~25fps)
        lastWheelTs = now;

        currentIndex += e.deltaY > 0 ? 1 : -1;
        currentIndex = Math.max(0, Math.min(currentIndex, validSOPs.length - 1));
        await loadImage(validSOPs[currentIndex]);
      }, { passive: false });

      // Teclado: flechas para navegar
      window.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          currentIndex = Math.max(0, currentIndex - 1);
          await loadImage(validSOPs[currentIndex]);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          currentIndex = Math.min(validSOPs.length - 1, currentIndex + 1);
          await loadImage(validSOPs[currentIndex]);
        } else if (e.key.toLowerCase() === 'r') {
          // Invertir pila rápidamente
          validSOPs.reverse();
          currentIndex = validSOPs.length - 1 - currentIndex;
          console.log("↕️ Stack invertido (atajo R)");
          await loadImage(validSOPs[currentIndex]);
        }
      });
    }

    async function loadImage(sopUID: string) {
      // Preferimos WADO-URI (requiere proxy /wado)
      const wadoUri = `wadouri:/wado?requestType=WADO&studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}&objectUID=${encodeURIComponent(sopUID)}&contentType=application/dicom`;
      try {
        console.log("Mostrando (WADO-URI):", wadoUri);
        const image = await cornerstone.loadAndCacheImage(wadoUri);
        cornerstone.displayImage(element, image);
        cornerstone.reset(element);
        overlay.textContent = `${currentIndex + 1} / ${validSOPs.length}`;
        console.log(`✔️ Renderizada por WADO-URI: ${sopUID} (${image.width}x${image.height})`);
        return;
      } catch (err) {
        console.warn("Falló WADO-URI, probando WADO-RS:", err);
      }

      // Fallback WADO-RS /frames/1
      const wadoRs = `wadors:/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/frames/1`;
      const image = await cornerstone.loadAndCacheImage(wadoRs);
      cornerstone.displayImage(element, image);
      cornerstone.reset(element);
      overlay.textContent = `${currentIndex + 1} / ${validSOPs.length}`;
      console.log(`✔️ Renderizada por WADO-RS: ${sopUID} (${image.width}x${image.height})`);
    }

  } catch (e) {
    console.error("Fallo en init():", e);
  }
}

init();

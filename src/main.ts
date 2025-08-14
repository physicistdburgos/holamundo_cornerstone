import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

// 1) Enlazar externals (suficiente para que el loader se integre con cornerstone)
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// 2) Inicializar Web Workers + codecs desde /public/dist (copiado desde node_modules)
cornerstoneWADOImageLoader.webWorkerManager.initialize({
  maxWebWorkers: Math.min(2, (navigator.hardwareConcurrency || 2)),
  startWebWorkersOnDemand: true,
  webWorkerPath: '/dist/index.worker.min.worker.js',
  taskConfiguration: {
    decodeTask: {
      initializeCodecsOnStartup: true,
      codecsPath: '/dist',   // aquí están los .wasm y workers auxiliares
      usePDFJS: false,
    },
  },
});

console.log("Iniciando aplicación...");

async function init() {
  const baseUrl  = "/dicom-web";
  const studyUID = "1.2.826.0.1.3680043.8.498.48565534201860650768733179605548160981";

  try {
    // 1) Buscar serie CT
    const seriesRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series?includefield=00080060,0020000E`);
    const seriesList = await seriesRes.json();
    const ctSeries   = seriesList.find((s: any) => s["00080060"]?.Value?.[0] === "CT");
    if (!ctSeries) throw new Error("No se encontró una serie CT.");
    const seriesUID  = ctSeries["0020000E"].Value[0];

    // 2) Instancias de la serie
    const instRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances`);
    const instList = await instRes.json();
    if (!instList.length) throw new Error("La serie CT no contiene imágenes.");

    // 3) Filtrar por metadatos: requiere 7FE0,0010 PixelData + filas/columnas/etc.
    const candidates: string[] = [];
    for (const inst of instList) {
      const sopUID = inst["00080018"]?.Value?.[0];
      if (!sopUID) continue;

      const metaUrl = `${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/metadata`;
      const metaRes = await fetch(metaUrl);
      const metadata = await metaRes.json();

      if (!Array.isArray(metadata) || metadata.length === 0) continue;
      const t = metadata[0];

      const rows            = t["00280010"]?.Value?.[0];
      const columns         = t["00280011"]?.Value?.[0];
      const samplesPerPixel = t["00280002"]?.Value?.[0];
      const bitsAllocated   = t["00280100"]?.Value?.[0];
      const pixelDataTag    = t["7FE00010"];
      const hasBulkData     = !!pixelDataTag && (pixelDataTag.BulkDataURI || pixelDataTag.InlineBinary);

      if (rows !== undefined && columns !== undefined && samplesPerPixel !== undefined && bitsAllocated !== undefined && hasBulkData) {
        candidates.push(sopUID);
      }
    }

    if (!candidates.length) throw new Error("No hay instancias con PixelData (7FE0,0010) accesible por DICOMweb.");

    // 4) Mostrar alguna candidata (primero WADO-URI, si falla WADO-RS)
    const element = document.getElementById("dicomImage") as HTMLDivElement;
    cornerstone.enable(element);

    let currentIndex = -1;
    for (let i = 0; i < candidates.length; i++) {
      const ok = await tryURIthenRS(element, studyUID, seriesUID, candidates[i]);
      if (ok) { currentIndex = i; break; }
    }
    if (currentIndex < 0) throw new Error("Ninguna candidata pudo decodificarse/mostrarse.");

    // 5) Navegación con rueda
    element.addEventListener("wheel", async (e) => {
      e.preventDefault();
      if (candidates.length < 2) return;
      currentIndex += e.deltaY > 0 ? 1 : -1;
      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= candidates.length) currentIndex = candidates.length - 1;
      await tryURIthenRS(element, studyUID, seriesUID, candidates[currentIndex]);
    });

  } catch (e) {
    console.error("Fallo en init():", e);
  }
}

async function tryURIthenRS(
  element: HTMLDivElement,
  studyUID: string,
  seriesUID: string,
  sopUID: string
): Promise<boolean> {
  // A) WADO-URI (requiere proxy /wado en webpack-dev-server)
  const wadoUri = `wadouri:/wado?requestType=WADO&studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}&objectUID=${encodeURIComponent(sopUID)}&contentType=application/dicom`;
  try {
    console.log("Mostrando (WADO-URI):", wadoUri);
    const img = await cornerstone.loadAndCacheImage(wadoUri);
    cornerstone.displayImage(element, img);
    console.log(`✔️ Renderizada por WADO-URI: ${sopUID} (${img.width}x${img.height})`);
    return true;
  } catch (err) {
    console.warn("Falló WADO-URI:", err);
  }

  // B) WADO-RS (frames/1)
  const wadoRs = `wadors:/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/frames/1`;
  try {
    console.log("Mostrando (WADO-RS frames/1):", wadoRs);
    const img = await cornerstone.loadAndCacheImage(wadoRs);
    cornerstone.displayImage(element, img);
    console.log(`✔️ Renderizada por WADO-RS: ${sopUID} (${img.width}x${img.height})`);
    return true;
  } catch (err) {
    console.error(`❌ No pudo renderizar SOP ${sopUID} por WADO-URI ni WADO-RS`, err);
    return false;
  }
}

init();

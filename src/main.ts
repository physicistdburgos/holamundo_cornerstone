import {
  init as cs3dInit,
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  metaData,
} from '@cornerstonejs/core';

import dcmjs from 'dcmjs';
import {
  // ...existing imports...
  PlanarFreehandROITool,
  annotation,
} from '@cornerstonejs/tools';

import {
  init as dicomImageLoaderInit,
  wadors,
} from '@cornerstonejs/dicom-image-loader';

import {
  init as toolsInit,
  ToolGroupManager,
  Enums as csToolsEnums,
  addTool,
  StackScrollTool,
  WindowLevelTool,
  PanTool,
  ZoomTool,
} from '@cornerstonejs/tools';

// === Utilidades ===
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

type Entry = {
  sopUID: string;
  hasPixel: boolean;
  instNumber?: number;
  ipp?: number[];
};

async function init() {
  const baseUrl  = "/dicom-web";
  const studyUID = "1.2.826.0.1.3680043.8.498.48565534201860650768733179605548160981";
  // Si conoces la serie RTSTRUCT exacta, indícala aquí o vía query string ?rtSeries=...
  const fromUrl = new URL(window.location.href);
  const rtStructSeriesUID = fromUrl.searchParams.get('rtSeries') || "2.25.409542177291492969352678104983992460200"; // opcional

  try {
    // 1) Series del estudio ⇒ elegir CT
    const seriesRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series?includefield=00080060,0020000E`);
    const seriesList = await seriesRes.json();
  const ctSeries   = seriesList.find((s: any) => s["00080060"]?.Value?.[0] === "CT");
    if (!ctSeries) throw new Error("No se encontró serie CT.");
    const seriesUID  = ctSeries["0020000E"].Value[0];

    // 2) Instancias de la serie
    const instRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances`);
    const instList = await instRes.json();
    if (!instList.length) throw new Error("La serie CT no contiene imágenes.");

    // 3) Preparar entradas y cachear metadatos por SOP
    const entries: Entry[] = [];
    const metaBySop = new Map<string, any>();

    for (const inst of instList) {
      const sopUID = inst["00080018"]?.Value?.[0];
      if (!sopUID) continue;

      const metaUrl = `${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopUID)}/metadata`;
      const metaRes = await fetch(metaUrl);
      const metadata = await metaRes.json();
      if (!Array.isArray(metadata) || metadata.length === 0) continue;

      const t = metadata[0];
      metaBySop.set(sopUID, t); // guarda el JSON /metadata

      const pixelDataTag = t["7FE00010"];
      const hasPixel = !!pixelDataTag && (pixelDataTag.BulkDataURI || pixelDataTag.InlineBinary);
      const instNumber = toNumber(t["00200013"]?.Value?.[0]);
      const ipp = toNumberArray(t["00200032"]);

      entries.push({ sopUID, hasPixel, instNumber, ipp });
    }

    // 4) Filtrar sólo instancias con píxel
    let stack = entries.filter(e => e.hasPixel);
    if (!stack.length) throw new Error("No hay instancias con PixelData.");

    // Mapa SOP -> imageId (lo usaremos para RTSTRUCT)
    const sopToImageId = new Map<string, string>();

    // Orden por InstanceNumber si la mayoría lo tiene
    const countWithInst = stack.filter(e => e.instNumber !== undefined).length;
    if (countWithInst > stack.length * 0.6) {
      stack.sort((a, b) => (a.instNumber! - b.instNumber!));
    }

    // 5) Inicializar Cornerstone3D + loader y registrar WADO-RS
    await cs3dInit();
    await dicomImageLoaderInit();

    wadors.register();
    metaData.addProvider(wadors.metaData.metaDataProvider, 10000);

    // 6) Construir imageIds (wadors) y precargar sus metadatos en el metaDataManager
    const imageIds = stack.map(e => {
      const imageId = `wadors:${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(e.sopUID)}/frames/1`;
      const dicomJson = metaBySop.get(e.sopUID);
      if (dicomJson) {
        wadors.metaDataManager.add(imageId, dicomJson);
      }
      sopToImageId.set(e.sopUID, imageId); // <— poblar el mapa para RTSTRUCT
      return imageId;
    });

    // 7) Inicializar herramientas y registrarlas
    await toolsInit();
    addTool(StackScrollTool);
    addTool(WindowLevelTool);
    addTool(PanTool);
    addTool(ZoomTool);
    addTool(PlanarFreehandROITool);

    // Asegurar un AnnotationManager (por FrameOfReference) para que se almacenen y rendericen anotaciones
    try {
      const mgr = (annotation.state as any).getAnnotationManager?.();
      if (!mgr) {
        const ForManager = (annotation as any).FrameOfReferenceSpecificAnnotationManager;
        if (ForManager) {
          (annotation.state as any).setAnnotationManager?.(new ForManager());
        }
      }
    } catch {}

    // 8) Motor de render y viewports
    const renderingEngineId = 'myRenderingEngine';
    const renderingEngine = new RenderingEngine(renderingEngineId);

    const axialEl = document.getElementById('axial') as HTMLDivElement;
    const sagEl   = document.getElementById('sagittal') as HTMLDivElement;
    const corEl   = document.getElementById('coronal') as HTMLDivElement;

    const { ViewportType, OrientationAxis } = Enums;

    renderingEngine.setViewports([
      {
        viewportId: 'CT_AXIAL',
        element: axialEl,
        type: ViewportType.ORTHOGRAPHIC,
        defaultOptions: { orientation: OrientationAxis.AXIAL },
      },
      {
        viewportId: 'CT_SAGITTAL',
        element: sagEl,
        type: ViewportType.ORTHOGRAPHIC,
        defaultOptions: { orientation: OrientationAxis.SAGITTAL },
      },
      {
        viewportId: 'CT_CORONAL',
        element: corEl,
        type: ViewportType.ORTHOGRAPHIC,
        defaultOptions: { orientation: OrientationAxis.CORONAL },
      },
    ]);

    // 9) Crear y cargar volumen
    const volumeId = 'cornerstoneStreamingImageVolume:ctVolumeId';
    const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
    await volume.load();

    // 10) Asignar volumen a los tres viewports
    setVolumesForViewports(
      renderingEngine,
      [{ volumeId }],
      ['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL']
    );

    // 11) ToolGroup: crearlo de forma segura
    const toolGroupId = 'CT_TOOLGROUP';
    let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (!toolGroup) {
      toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
    }
    if (!toolGroup) {
      throw new Error('No se pudo crear/obtener el ToolGroup');
    }

    // Añadir herramientas al grupo
    toolGroup.addTool(StackScrollTool.toolName);
    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(PlanarFreehandROITool.toolName); // asegurar que está en el grupo

    // Enlazar viewports (los tres)
    toolGroup.addViewport('CT_AXIAL', renderingEngineId);
    toolGroup.addViewport('CT_SAGITTAL', renderingEngineId);
    toolGroup.addViewport('CT_CORONAL', renderingEngineId);

    // Ocultar cualquier texto/etiqueta de los contornos (solo dibujar la forma)
    try {
      toolGroup.setToolConfiguration(PlanarFreehandROITool.toolName, {
        getTextLines: () => [],
        alwaysRenderTextBox: false,
        hideTextBox: true,
      } as any);
    } catch {}

    // Activar con bindings (izq WW/WL, medio Pan, der Zoom, rueda StackScroll)
    const { MouseBindings } = csToolsEnums;
    toolGroup.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
    toolGroup.setToolActive(PanTool.toolName,         { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });
    toolGroup.setToolActive(ZoomTool.toolName,        { bindings: [{ mouseButton: MouseBindings.Secondary }] });
    toolGroup.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
    toolGroup.setToolPassive(PlanarFreehandROITool.toolName); // mostrar overlays sin interacción

    // 12) Render
    renderingEngine.renderViewports(['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL']);

    // 13) Cargar y superponer RTSTRUCT
    await overlayRTStructContours({
      baseUrl,
      studyUID,
      sopToImageId,
      renderingEngine, // pasar instancia directamente
      frameOfReferenceUIDHint: metaBySop.get(stack[0].sopUID)?.['00200052']?.Value?.[0],
  rtSeriesUID: rtStructSeriesUID || undefined,
    });

    console.log(`Volumen cargado con ${imageIds.length} cortes y tools activas (Axial/Sagittal/Coronal).`);
  } catch (err) {
    console.error("Fallo en init():", err);
  }
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
}

function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}
function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}
function length(v: [number, number, number]): number {
  return Math.sqrt(dot(v, v));
}
function normalize(v: [number, number, number]): [number, number, number] {
  const len = length(v);
  if (len === 0) return [0, 0, 0];
  return [v[0]/len, v[1]/len, v[2]/len];
}
function pickViewUpFromNormal(n: [number, number, number]): [number, number, number] {
  // Choose a world axis that isn't parallel to n, then orthonormalize
  const worldUp: [number, number, number] = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const proj = dot(n, worldUp);
  const up = normalize([worldUp[0] - proj * n[0], worldUp[1] - proj * n[1], worldUp[2] - proj * n[2]]);
  return up;
}

async function overlayRTStructContours(opts: {
  baseUrl: string;
  studyUID: string;
  sopToImageId: Map<string, string>;
  renderingEngine: RenderingEngine;
  frameOfReferenceUIDHint?: string;
  rtSeriesUID?: string;
}) {
  const { baseUrl, studyUID, sopToImageId, renderingEngine, frameOfReferenceUIDHint, rtSeriesUID } = opts;

  // 1) Buscar la serie RTSTRUCT del estudio
  let rtSeriesUIDLocal = rtSeriesUID;
  if (!rtSeriesUIDLocal) {
    const seriesRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series?includefield=00080060,0020000E`);
    const seriesList = await seriesRes.json();
    const rtSeries   = seriesList.find((s: any) => s["00080060"]?.Value?.[0] === "RTSTRUCT");
    if (!rtSeries) {
      console.warn("No se encontró serie RTSTRUCT en el estudio.");
      return;
    }
    rtSeriesUIDLocal = rtSeries["0020000E"].Value[0];
  }
  if (!rtSeriesUIDLocal) {
    console.warn('rtSeriesUID indefinido, no se puede continuar.');
    return;
  }

  // 2) Obtener instancia(s) RTSTRUCT (usaremos la primera)
  const instRes  = await fetch(`${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(rtSeriesUIDLocal)}/instances`);
  const instList = await instRes.json();
  if (!instList.length) {
    console.warn("La serie RTSTRUCT no tiene instancias.");
    return;
  }
  const rtSopUID = instList[0]["00080018"]?.Value?.[0];
  if (!rtSopUID) {
    console.warn("RTSTRUCT sin SOPInstanceUID.");
    return;
  }

  // 3) Preferir WADO-RS /metadata (DICOM JSON) y parsear directamente
  const rtUrl = `${baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(rtSeriesUIDLocal)}/instances/${encodeURIComponent(rtSopUID)}`;
  let ds: any | undefined;
  try {
    const metaRes = await fetch(`${rtUrl}/metadata`);
    if (metaRes.ok) {
      const metaJson = await metaRes.json();
      const raw = Array.isArray(metaJson) ? metaJson[0] : metaJson;
      if (raw) {
        // Adaptar desde DICOM JSON (tags numéricos) a estructura consumible
        const getValue = (obj: any, tag: string) => obj?.[tag]?.Value?.[0];
        const roiContourSeq = raw['30060039']?.Value || [];
        const structureSetROISeq = raw['30060020']?.Value || [];
        ds = {
          FrameOfReferenceUID: getValue(raw, '00200052') || frameOfReferenceUIDHint,
          StructureSetROISequence: structureSetROISeq.map((s: any) => ({
            ROINumber: Number(s['30060022']?.Value?.[0]),
            ROIName: (s['30060026']?.Value?.[0] ?? '').toString(),
          })),
          ROIContourSequence: roiContourSeq.map((roiItem: any) => {
            const displayColor = getValue(roiItem, '3006002A');
            const refRoiNum    = Number(roiItem['30060084']?.Value?.[0]);
            const contourSeq = roiItem['30060040']?.Value || [];
            return {
              ROIDisplayColor: Array.isArray(displayColor) ? displayColor.map(Number) : undefined,
              ReferencedROINumber: Number.isFinite(refRoiNum) ? refRoiNum : undefined,
              ContourSequence: contourSeq.map((c: any) => {
                const data = (c['30060050']?.Value || []) as number[];
    // Prefer ContourImageSequence (3006,0016); fallback to ReferencedImageSequence (0008,1140)
    const imgSeq = c['30060016']?.Value || c['00081140']?.Value || [];
    const refSops = imgSeq
      .map((v: any) => v?.['00081155']?.Value?.[0])
      .filter(Boolean);
                return {
                  ContourData: data.map(Number),
                  ContourImageSequence: refSops.map((sop: string) => ({ ReferencedSOPInstanceUID: sop })),
                };
              }),
            };
          }),
        };
  console.info(`RTSTRUCT via /metadata: FOR=${ds.FrameOfReferenceUID}, ROIContours=${ds.ROIContourSequence.length}`);
      }
    }
  } catch {}

  // 4) Si no hubo /metadata usable, probar descargar Parte-10 y parsear con dcmjs; luego WADO-URI
  if (!ds) {
    const acceptList = [
      'application/dicom;transfer-syntax=*',
      'application/dicom',
      'application/octet-stream',
    ];
    let rtRes: Response | undefined;
    for (const accept of acceptList) {
      try {
        const res = await fetch(rtUrl, { headers: { Accept: accept } });
        if (res.ok) {
          rtRes = res;
          break;
        }
      } catch {}
    }
    if (rtRes && rtRes.ok) {
      const rtBuffer = await rtRes.arrayBuffer();
      const dicomData = dcmjs.data.DicomMessage.readFile(rtBuffer);
      const natural = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
      natural._meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dicomData.meta);
      ds = natural;
    } else {
      console.warn(`No se pudo descargar el RTSTRUCT (WADO-RS). URL=${rtUrl}. Intentando /wado...`);
      const wadoUri = `/wado?requestType=WADO&studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(rtSeriesUIDLocal)}&objectUID=${encodeURIComponent(rtSopUID)}&contentType=application/dicom`;
      try {
        const uriRes = await fetch(wadoUri, { headers: { Accept: 'application/dicom' } });
        if (uriRes.ok) {
          const buf = await uriRes.arrayBuffer();
          const dicomData = dcmjs.data.DicomMessage.readFile(buf);
          const natural = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
          natural._meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dicomData.meta);
          ds = natural;
          console.info('RTSTRUCT recuperado vía WADO-URI.');
        }
      } catch (e) {
        console.warn('Fallo WADO-URI para RTSTRUCT:', e);
      }
    }
  }

  if (!ds) {
    console.warn('No se pudo obtener dataset RTSTRUCT.');
    return;
  }

  const forUID = ds.FrameOfReferenceUID || frameOfReferenceUIDHint;
  if (!forUID) {
    console.warn("RTSTRUCT sin FrameOfReferenceUID; no se puede asegurar la referencia.");
  }

  const roiContourSeq = ds.ROIContourSequence || [];
  if (!roiContourSeq.length) {
    console.warn('RTSTRUCT sin contornos: ROIContourSequence vacío. No hay nada que dibujar.');
    return;
  }

  // ROI selection by name
  const roiNameByNumber = new Map<number, string>();
  (ds.StructureSetROISequence || []).forEach((it: any) => {
    if (Number.isFinite(it?.ROINumber)) {
      roiNameByNumber.set(Number(it.ROINumber), (it.ROIName ?? '').toString());
    }
  });
  const url = new URL(window.location.href);
  const includeSet = url.searchParams.get('roi')
    ? new Set(url.searchParams.get('roi')!.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
    : undefined;
  const excludeSet = url.searchParams.get('excludeRoi')
    ? new Set(url.searchParams.get('excludeRoi')!.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
    : undefined;
  const DISABLED_ROIS = new Set<string>([
    'exceso', 'interseccion','defecto'
    // Add lowercase ROI names to always hide here, e.g.: 'parotid l'
  ]);

  const allImageIds: string[] = Array.from(sopToImageId.values());

  // 5) Recorremos ROIContourSequence y añadimos anotaciones por ContourSequence
  for (const roiContour of roiContourSeq) {
    const roiNumber: number | undefined = Number.isFinite(roiContour.ReferencedROINumber)
      ? Number(roiContour.ReferencedROINumber)
      : undefined;
    const roiName = roiNumber != null ? roiNameByNumber.get(roiNumber) : undefined;
    const roiNameKey = roiName?.toLowerCase();

    if (includeSet && (!roiNameKey || !includeSet.has(roiNameKey))) continue;
    if (excludeSet && roiNameKey && excludeSet.has(roiNameKey)) continue;
    if (roiNameKey && DISABLED_ROIS.has(roiNameKey)) continue;
    const displayColor: number[] | undefined = roiContour.ROIDisplayColor; // [R,G,B] 0..255
    const contours = roiContour.ContourSequence || [];
    for (const contour of contours) {
      const refSops =
        contour.ContourImageSequence?.map((ci: any) => ci.ReferencedSOPInstanceUID).filter(Boolean) || [];

      // Si hay referencia, usamos la primera imagen de referencia para el plano
      const refSOP = refSops[0];
      let referencedImageId = refSOP ? sopToImageId.get(refSOP) : undefined;

      // Plane metadata (para correcta proyección en el viewport)
      let viewPlaneNormal: [number, number, number] | undefined;
      let viewUp: [number, number, number] | undefined;
      if (referencedImageId) {
        const ipm = metaData.get('imagePlaneModule', referencedImageId) as any;
        if (ipm?.rowCosines && ipm?.columnCosines) {
          const row: [number, number, number] = [ipm.rowCosines[0], ipm.rowCosines[1], ipm.rowCosines[2]];
          const col: [number, number, number] = [ipm.columnCosines[0], ipm.columnCosines[1], ipm.columnCosines[2]];
          viewPlaneNormal = normalize(cross(row, col));
          viewUp = normalize(col);
        }
      }

      // Convertir ContourData a puntos 3D (mm, coords paciente)
      const data = contour.ContourData as number[] | undefined;
      if (!data || data.length < 6) continue;
      const points: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 3) {
        points.push([data[i], data[i + 1], data[i + 2]]);
      }

      // Si no hay imagen referenciada, intentar deducir el plano del contorno y mapearlo al corte más cercano
      if (!referencedImageId) {
        const p0 = points[0];
        // Buscar dos puntos no colineales para la normal
        let n: [number, number, number] | undefined;
        for (let i = 1; i < points.length - 1 && !n; i++) {
          const v1 = sub(points[i], p0);
          const v2 = sub(points[i + 1], p0);
          const nn = cross(v1, v2);
          if (length(nn) > 1e-3) n = normalize(nn);
        }
        if (n) {
          // Ecuación del plano: n·x = d
          const dPlane = dot(n, p0);
          let bestId: string | undefined;
          let bestDist = Number.POSITIVE_INFINITY;
          let bestN: [number, number, number] | undefined;
          let bestUp: [number, number, number] | undefined;
          for (const imgId of allImageIds) {
            const ipm = metaData.get('imagePlaneModule', imgId) as any;
            if (!ipm?.rowCosines || !ipm?.columnCosines || !ipm?.imagePositionPatient) continue;
            const row: [number, number, number] = [ipm.rowCosines[0], ipm.rowCosines[1], ipm.rowCosines[2]];
            const col: [number, number, number] = [ipm.columnCosines[0], ipm.columnCosines[1], ipm.columnCosines[2]];
            const nImg = normalize(cross(row, col));
            const sim = Math.abs(dot(n, nImg));
            if (sim < 0.9) continue; // exigir similares
            const ipp: [number, number, number] = [ipm.imagePositionPatient[0], ipm.imagePositionPatient[1], ipm.imagePositionPatient[2]];
            const dImg = dot(nImg, ipp);
            const dist = Math.abs(dPlane - dImg);
            if (dist < bestDist) {
              bestDist = dist;
              bestId = imgId;
              bestN = nImg;
              bestUp = normalize(col);
            }
          }
          if (bestId) {
            referencedImageId = bestId;
            viewPlaneNormal = bestN;
            viewUp = bestUp;
            console.info('RTSTRUCT: mapeo por plano al corte más cercano:', { bestId, bestDist: bestDist.toFixed(3) });
          } else {
            // Sin coincidencia clara, al menos proporcionar normal y un up razonable
            viewPlaneNormal = n;
            viewUp = pickViewUpFromNormal(n);
            console.info('RTSTRUCT: sin ContourImageSequence; uso plano derivado del contorno.');
          }
        }
      }

      // Añadir anotación (PlanarFreehandROITool) en coords de mundo (paciente)
      try {
        annotation.state.addAnnotation(
          {
            metadata: {
              toolName: PlanarFreehandROITool.toolName,
              referencedImageId,
              FrameOfReferenceUID: forUID,
              viewPlaneNormal,
              viewUp,
              color: displayColor,
            },
            data: {
              contour: {
                polyline: points,
                closed: true,
              },
              handles: {
                points,
                activeHandleIndex: null,
                textBox: { hasMoved: false },
              },
              cachedStats: {},
              label: '',
              polylineClosed: true,
              closed: true,
            },
          } as any,
          // Group key for annotation manager; use FrameOfReferenceUID
          forUID as string
        );
      } catch (e) {
        console.warn('No se pudo crear anotación para un contorno RTSTRUCT:', e);
      }
    }
  }

  // Forzar re-render de los tres viewports
  renderingEngine.renderViewports(['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL']);
}

init();

import {
  init as cs3dInit,
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  metaData,
} from '@cornerstonejs/core';

import {
  init as dicomImageLoaderInit,
  wadors,
} from '@cornerstonejs/dicom-image-loader';

import {
  init as toolsInit,
  ToolGroupManager,
  Enums as csToolsEnums,
  addTool,
  StackScrollTool,      // 👈 usamos este
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
      return imageId;
    });

    // 7) Inicializar herramientas y registrarlas
    await toolsInit();
    addTool(StackScrollTool);
    addTool(WindowLevelTool);
    addTool(PanTool);
    addTool(ZoomTool);

    // 8) Motor de render y viewports
    const renderingEngineId = 'myRenderingEngine';
    const renderingEngine = new RenderingEngine(renderingEngineId);

    const axialEl = document.getElementById('axial') as HTMLDivElement;
    const sagEl   = document.getElementById('sagittal') as HTMLDivElement;

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
    ]);

    // 9) Crear y cargar volumen
    const volumeId = 'cornerstoneStreamingImageVolume:ctVolumeId';
    const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
    await volume.load();

    // 10) Asignar volumen a ambos viewports
    setVolumesForViewports(
      renderingEngine,
      [{ volumeId }],
      ['CT_AXIAL', 'CT_SAGITTAL']
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

    // Enlazar viewports
    toolGroup.addViewport('CT_AXIAL', renderingEngineId);
    toolGroup.addViewport('CT_SAGITTAL', renderingEngineId);

    // Activar con bindings (izq WW/WL, medio Pan, der Zoom, rueda StackScroll)
    const { MouseBindings } = csToolsEnums;
    toolGroup.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
    toolGroup.setToolActive(PanTool.toolName,         { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });
    toolGroup.setToolActive(ZoomTool.toolName,        { bindings: [{ mouseButton: MouseBindings.Secondary }] });
    toolGroup.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] }); // 👈 rueda

    // 12) Render
    renderingEngine.renderViewports(['CT_AXIAL', 'CT_SAGITTAL']);

    console.log(`Volumen cargado con ${imageIds.length} cortes y tools activas (rueda = scroll).`);
  } catch (err) {
    console.error("Fallo en init():", err);
  }
}

init();

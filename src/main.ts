// main.ts

import * as cornerstone from "cornerstone-core";
import * as cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import * as dicomParser from "dicom-parser";
import * as cornerstoneTools from "cornerstone-tools";
import * as cornerstoneMath from "cornerstone-math";
import Hammer from "hammerjs";
import { setupTools } from "./Tools/setupTools"; // 👈 importas tu función

// Configurar dependencias externas
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
cornerstoneTools.external.Hammer = Hammer;

cornerstoneTools.init();

const element = document.getElementById("dicomImage");
if (!element) throw new Error("Element not found");

cornerstone.enable(element);

const imageId = "wadouri:/dicom/1-1.dcm";

cornerstone
  .loadImage(imageId)
  .then((image: any) => {
    cornerstone.displayImage(element, image);
    cornerstone.fitToWindow(element);

    // Función que inicializa las herramientas
    setupTools(element);
  })
  .catch((err: any) => {
    console.error("Error loading local DICOM file:", err);
  });



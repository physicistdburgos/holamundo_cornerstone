// main.ts

import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

// Set up cornerstone dependencies
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

const element = document.getElementById('dicomImage');
if (!element) throw new Error("Element not found");

// Enable cornerstone
cornerstone.enable(element);

// YOUR LOCAL FILE URL 👇
const imageId = 'wadouri:/dicom/CT_oar_688.dcm';


// Load and display your local DICOM file
cornerstone.loadImage(imageId).then((image: any) => {
  cornerstone.displayImage(element, image);
  cornerstone.fitToWindow(element);
}).catch((err: any) => {
  console.error("Error loading local DICOM file:", err);
});

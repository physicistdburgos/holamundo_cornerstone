// Import cornerstone libraries
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

// Connect cornerstone with external libraries
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Enable the HTML element to display images
const element = document.getElementById('dicomImage');
if (element === null) {
  throw new Error("Cannot find 'dicomImage' element.");
}

cornerstone.enable(element);

// Example DICOM image URL (replace this with your actual image URL)
const imageId = 'wadouri:https://raw.githubusercontent.com/cornerstonejs/cornerstoneWADOImageLoader/master/testImages/CT2_J2KR';

// Load and display the DICOM image
cornerstone.loadImage(imageId).then((image: any) => {
  cornerstone.displayImage(element, image);
  cornerstone.fitToWindow(element);
}).catch((err: any) => console.error('Error:', err));


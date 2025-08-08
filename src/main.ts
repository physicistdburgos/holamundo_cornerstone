import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// (Optional but good) initialize web workers for speed

const element = document.getElementById('dicomImage');
if (!element) throw new Error("Element not found");
cornerstone.enable(element);

// Build imageIds from your numbered files
const totalSlices = 89;
const imageIds: string[] = [];
for (let i = 1; i <= totalSlices; i++) {
  const sliceNumber = i.toString().padStart(3, '0');  // 001.dcm ... 089.dcm
  imageIds.push(`wadouri:/solo_CTs/${sliceNumber}.dcm`);
}

// helper: tolerant compare
const nearly = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

// Load-and-cache all (so metadata is available), then read the right keys
Promise.all(
  imageIds.map(id =>
    cornerstone.loadAndCacheImage(id).then((img: any) => {
      const ipm = cornerstone.metaData.get('imagePlaneModule', id) as any | undefined;
      // Fallbacks if needed (rare):
      // const iop = cornerstone.metaData.get('x00200037', id); // image orientation patient
      // const ipp = cornerstone.metaData.get('x00200032', id); // image position patient

      const orientation = ipm?.imageOrientationPatient;    // [r1,r2,r3,c1,c2,c3]
      const position    = ipm?.imagePositionPatient;       // [x,y,z]

      return { id, orientation, position };
    })
  )
).then(imagesInfo => {
  // Determine plane for each image (axial/coronal/sagittal) using direction cosines
  imagesInfo.forEach(info => {
    const ori = info.orientation as number[] | undefined;
    if (!ori || ori.length !== 6) {
      (info as any).plane = 'Unknown';
      return;
    }
    const [r1, r2, r3, c1, c2, c3] = ori;

    // Typical cosines (tolerant):
    // Axial:    row≈[1,0,0], col≈[0,1,0]
    // Coronal:  row≈[1,0,0], col≈[0,0,-1]  (sign may vary)
    // Sagittal: row≈[0,1,0], col≈[0,0,-1]
    if (nearly(Math.abs(r1), 1) && nearly(Math.abs(c2), 1) && nearly(Math.abs(r2), 0) && nearly(Math.abs(c1), 0) && nearly(Math.abs(r3), 0) && nearly(Math.abs(c3), 0)) {
      (info as any).plane = 'Axial';
    } else if (nearly(Math.abs(r1), 1) && nearly(Math.abs(c3), 1)) {
      (info as any).plane = 'Coronal';
    } else if (nearly(Math.abs(r2), 1) && nearly(Math.abs(c3), 1)) {
      (info as any).plane = 'Sagittal';
    } else {
      (info as any).plane = 'Unknown';
    }
  });

  // Filter to axial (change if you want coronal/sagittal)
  const axial = imagesInfo.filter(i => (i as any).plane === 'Axial' && i.position);

  if (axial.length === 0) {
    console.error('No axial slices found. Dumping first item for debugging:', imagesInfo[0]);
    console.error('Check that metaData key "imagePlaneModule" is available and files belong to the same series.');
    alert('No axial slices found. See console for details.');
    return;
  }

  // Sort by slice position (z). If orientation is not perfectly axial, compute using normal vector:
  axial.sort((a, b) => (a.position![2] - b.position![2]));

  const sortedIds = axial.map(i => i.id);

  const stack = { currentImageIdIndex: 0, imageIds: sortedIds };

  cornerstone.loadImage(stack.imageIds[0]).then((image: any) => {
    cornerstone.displayImage(element, image);
    (element as any).stack = stack;

    element.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      const dir = event.deltaY > 0 ? 1 : -1;
      stack.currentImageIdIndex = Math.min(
        Math.max(stack.currentImageIdIndex + dir, 0),
        stack.imageIds.length - 1
      );
      cornerstone.loadImage(stack.imageIds[stack.currentImageIdIndex]).then((newImage: any) => {
        cornerstone.displayImage(element, newImage);
      });
    });
  });
}).catch(err => {
  console.error('Error while loading images / metadata:', err);
});

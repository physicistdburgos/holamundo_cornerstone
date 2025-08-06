import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

const element = document.getElementById('dicomImage');
if (!element) throw new Error("Element not found");
cornerstone.enable(element);

// Paso 1: Lista de imágenes DICOM locales
const totalSlices = 50; // o el número de imágenes que tengas
const imageIds = [];

for (let i = 1; i <= totalSlices; i++) {
  const sliceNumber = i.toString().padStart(3, '0');
  const imageId = `wadouri:/solo_CTs/${sliceNumber}.dcm`;
  imageIds.push(imageId);
}

// Paso 2: Configurar el stack
const stack = {
  currentImageIdIndex: 0,
  imageIds: imageIds,
};

// Paso 3: Cargar la primera imagen y permitir navegación
cornerstone.loadImage(stack.imageIds[0]).then((image: any) => {
  cornerstone.displayImage(element, image);

  // Guardar el stack en el elemento
  (element as any).stack = stack;

  // Evento: usar rueda del mouse para navegar
  element.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();

    const direction = event.deltaY > 0 ? 1 : -1;
    stack.currentImageIdIndex += direction;

    // Limitar el índice
    if (stack.currentImageIdIndex < 0) {
      stack.currentImageIdIndex = 0;
    } else if (stack.currentImageIdIndex >= stack.imageIds.length) {
      stack.currentImageIdIndex = stack.imageIds.length - 1;
    }

    // Mostrar la nueva imagen
    cornerstone.loadImage(stack.imageIds[stack.currentImageIdIndex]).then((newImage: any) => {
      cornerstone.displayImage(element, newImage);
    });
  });
});

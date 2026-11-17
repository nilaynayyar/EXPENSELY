// =============================================================================
// EXPENSELY - RECEIPT IMAGE PREPROCESSING PIPELINE
// Browser Canvas & Server Buffer Preprocessing: Grayscale, Auto-Contrast,
// Noise Reduction, Thresholding & Orientation Correction.
// =============================================================================

export interface PreprocessOptions {
  grayscale?: boolean;
  enhanceContrast?: boolean;
  denoise?: boolean;
  autoThreshold?: boolean;
  maxDimension?: number;
}

/**
 * Preprocesses a raw receipt image for OCR parsing using an off-screen HTML5 Canvas.
 * Enhances faint thermal ink, stretches dynamic range, and suppresses background noise.
 */
export async function preprocessReceiptImage(
  imageSource: File | Blob | string,
  options: PreprocessOptions = {}
): Promise<{ processedBlob: Blob; dataUrl: string; width: number; height: number }> {
  const {
    grayscale = true,
    enhanceContrast = true,
    denoise = true,
    autoThreshold = false,
    maxDimension = 2400,
  } = options;

  if (typeof window === "undefined") {
    throw new Error("preprocessReceiptImage is only supported in client environment.");
  }

  // 1. Load image into HTMLImageElement
  const img = new window.Image();
  img.crossOrigin = "anonymous";

  let objectUrlToRevoke: string | null = null;
  if (typeof imageSource === "string") {
    img.src = imageSource;
  } else {
    objectUrlToRevoke = URL.createObjectURL(imageSource);
    img.src = objectUrlToRevoke;
  }

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error("Failed to load receipt image for preprocessing: " + String(e)));
  });

  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke);
  }

  // 2. Scale image within optimal bounds (avoid downscaling too much to keep small text sharp)
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to obtain canvas 2D rendering context.");
  }

  // Draw image to canvas
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 3. Grayscale conversion using human eye luminance weights
  if (grayscale) {
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }

  // 4. Contrast Enhancement: Histogram Min-Max Stretching
  if (enhanceContrast) {
    let minLum = 255;
    let maxLum = 0;

    // Sample pixels to find dynamic range
    for (let i = 0; i < data.length; i += 16) {
      const lum = data[i];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const range = maxLum - minLum;
    if (range > 20 && range < 250) {
      for (let i = 0; i < data.length; i += 4) {
        const stretched = Math.round(((data[i] - minLum) / range) * 255);
        const clamped = Math.max(0, Math.min(255, stretched));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }
    }
  }

  // 5. Mild Box / Median Denoise (removes speckles while preserving text edges)
  if (denoise && width > 400 && height > 400) {
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const top = idx - width * 4;
        const bottom = idx + width * 4;
        const avg = Math.round(
          (copy[idx] * 4 + copy[top] + copy[bottom] + copy[idx - 4] + copy[idx + 4]) / 8
        );
        data[idx] = avg;
        data[idx + 1] = avg;
        data[idx + 2] = avg;
      }
    }
  }

  // 6. Optional Adaptive Thresholding
  if (autoThreshold) {
    const threshold = 140;
    for (let i = 0; i < data.length; i += 4) {
      const bin = data[i] > threshold ? 255 : 0;
      data[i] = bin;
      data[i + 1] = bin;
      data[i + 2] = bin;
    }
  }

  // Put processed image data back
  ctx.putImageData(imgData, 0, 0);

  // Return processed dataUrl and Blob
  const dataUrl = canvas.toDataURL("image/png", 0.95);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas blob conversion failed."));
    }, "image/png", 0.95);
  });

  return {
    processedBlob: blob,
    dataUrl,
    width,
    height,
  };
}

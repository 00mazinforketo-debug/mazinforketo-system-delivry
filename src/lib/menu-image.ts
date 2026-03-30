const IMAGE_SOURCE_PATTERN = /^(data:image\/|https?:\/\/|\/|blob:)/i;

export interface PreparedMenuImageAsset {
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  originalDataUrl: string;
  previewDataUrl: string;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });

export const isMenuImageSource = (value?: string | null) => Boolean(value && IMAGE_SOURCE_PATTERN.test(value));

const renderCompressedDataUrl = async (
  source: string,
  options?: {
    maxDimension?: number;
    quality?: number;
  },
) => {
  if (!source) {
    return source;
  }

  const maxDimension = options?.maxDimension ?? 1280;
  const quality = options?.quality ?? 0.82;

  try {
    const image = await loadImageElement(source);
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return source;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return source;
  }
};

export const compressMenuImageDataUrl = async (
  source: string,
  options?: {
    maxDimension?: number;
    quality?: number;
  },
) => renderCompressedDataUrl(source, options);

export const compressMenuImageFile = async (
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
  },
) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl || file.type === 'image/svg+xml') {
    return dataUrl;
  }

  return renderCompressedDataUrl(dataUrl, options);
};

export const prepareMenuImageAsset = async (file: File): Promise<PreparedMenuImageAsset | null> => {
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl) {
    return null;
  }

  if (file.type === 'image/svg+xml') {
    return {
      fileName: file.name || 'menu-image.svg',
      mimeType: file.type || 'image/svg+xml',
      byteSize: file.size,
      width: 0,
      height: 0,
      originalDataUrl: dataUrl,
      previewDataUrl: dataUrl,
    };
  }

  try {
    const image = await loadImageElement(dataUrl);
    const originalDataUrl = await renderCompressedDataUrl(dataUrl, {
      maxDimension: 1280,
      quality: 0.84,
    });
    const previewDataUrl = await renderCompressedDataUrl(dataUrl, {
      maxDimension: 480,
      quality: 0.78,
    });

    return {
      fileName: file.name || 'menu-image.jpg',
      mimeType: file.type || 'image/jpeg',
      byteSize: file.size,
      width: image.naturalWidth,
      height: image.naturalHeight,
      originalDataUrl,
      previewDataUrl,
    };
  } catch {
    return {
      fileName: file.name || 'menu-image.jpg',
      mimeType: file.type || 'image/jpeg',
      byteSize: file.size,
      width: 0,
      height: 0,
      originalDataUrl: dataUrl,
      previewDataUrl: dataUrl,
    };
  }
};

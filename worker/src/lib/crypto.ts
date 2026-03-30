const encoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
};

export const hashPin = (pin: string, pepper: string) => sha256Hex(`${pepper}:pin:${pin}`);

export const hashSessionToken = (token: string, pepper: string) => sha256Hex(`${pepper}:session:${token}`);

export const createOpaqueToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
};

export const encodeBase64 = (bytes: Uint8Array) => {
  let output = '';
  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }

  return btoa(output);
};

export const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

export const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string) =>
  `data:${mimeType};base64,${encodeBase64(new Uint8Array(buffer))}`;

export const dataUrlToBytes = (value: string) => {
  const matched = value.match(/^data:(.+?);base64,(.+)$/);
  if (!matched) {
    throw new Error('فۆرماتی data URL دروست نییە.');
  }

  return {
    mimeType: matched[1],
    bytes: decodeBase64(matched[2]),
  };
};

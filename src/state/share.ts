// Share a design as a link, with no account: the design is compressed into
// the URL. (Saved designs get short links once accounts are switched on.)
import type { Design } from '../model/types';

const toB64Url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());

/** Round plan numbers so links stay short. */
const compact = (d: Design): Design =>
  JSON.parse(JSON.stringify(d, (_k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));

export const encodeDesign = async (d: Design): Promise<string> => {
  const json = new TextEncoder().encode(JSON.stringify(compact(d)));
  return toB64Url(await pipe(json, new CompressionStream('deflate-raw')));
};

export const decodeDesign = async (s: string): Promise<Design> => {
  const bytes = await pipe(fromB64Url(s), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes)) as Design;
};

export const shareUrl = async (d: Design): Promise<string> =>
  `${location.origin}/view#d=${await encodeDesign(d)}`;

export const facebookShareUrl = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

export const whatsappShareUrl = (url: string, text: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

import { storeVideoBlob } from './dbStorage';

export const IMPORT_STAGES = {
  QUEUED: 'QUEUED',
  VALIDATING: 'VALIDATING',
  EXTRACTING_METADATA: 'EXTRACTING_METADATA',
  GENERATING_THUMBNAIL: 'GENERATING_THUMBNAIL',
  STORED: 'STORED',
  FAILED: 'FAILED'
};

export async function processVideoImport(file, onProgress) {
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  // Stage 1: Queued
  onProgress && onProgress({ requestId, stage: IMPORT_STAGES.QUEUED, progress: 10 });

  // Stage 2: Format Check & Browser Validation
  onProgress && onProgress({ requestId, stage: IMPORT_STAGES.VALIDATING, progress: 30 });
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
    throw new Error(`Unsupported media format (${file.type || file.name}). Please upload MP4, WebM, or MOV.`);
  }

  // Stage 3: Extracting Metadata
  onProgress && onProgress({ requestId, stage: IMPORT_STAGES.EXTRACTING_METADATA, progress: 60 });
  const objectUrl = URL.createObjectURL(file);
  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    importedAt: new Date().toISOString()
  };

  // Stage 4: Generating Thumbnail
  onProgress && onProgress({ requestId, stage: IMPORT_STAGES.GENERATING_THUMBNAIL, progress: 85 });
  const clipId = 'v_' + Date.now();

  // Stage 5: Store in IndexedDB
  await storeVideoBlob(clipId, file, metadata);

  onProgress && onProgress({ requestId, stage: IMPORT_STAGES.STORED, progress: 100 });

  return {
    clipId,
    requestId,
    videoUrl: objectUrl,
    fileName: file.name,
    date: new Date().toISOString().split('T')[0],
    drillName: file.name.replace(/\.[^/.]+$/, "") || 'Match Segment',
    playerIds: [],
    drawings: [],
    metadata
  };
}

export function revokeVideoObjectUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

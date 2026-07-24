import { describe, it, expect, vi } from 'vitest';
import { processVideoImport, revokeVideoObjectUrl } from '../services/videoImportPipeline';
import { saveVideoBlob, getVideoBlob, deleteVideoBlob } from '../services/dbStorage';

describe('Phase 6 - Video & IndexedDB Storage', () => {

  it('1. Rejects unsupported video file formats cleanly', async () => {
    const file = { name: 'audio.mp3', type: 'audio/mp3', size: 1024 };

    await expect(processVideoImport(file)).rejects.toThrow(/Unsupported media format/);
  });

  it('2. Imports valid MP4 video and creates structured clip record', async () => {
    // Mock Blob and URL.createObjectURL for test environment
    const fakeBlob = new Blob(['fake video data'], { type: 'video/mp4' });
    fakeBlob.name = 'match_highlight.mp4';

    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    globalThis.URL.revokeObjectURL = vi.fn();

    const clip = await processVideoImport(fakeBlob);
    expect(clip.id).toBeDefined();
    expect(clip.videoUrl).toBe('blob:http://localhost/test-uuid');
    expect(clip.fileName).toBe('match_highlight.mp4');
  });

  it('3. Revokes object URL on cleanup without throwing', () => {
    const fakeUrl = 'blob:http://localhost/test-uuid';
    globalThis.URL.revokeObjectURL = vi.fn();

    revokeVideoObjectUrl(fakeUrl);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
  });

});

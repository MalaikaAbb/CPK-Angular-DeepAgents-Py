/**
 * Mux the voiceover tracks onto the clips already in `autorecorder/videos/`.
 *
 * `ci/automate.mjs` runs this same step at the end of a full pipeline run, so
 * CI needs nothing extra. This entry point exists for the other half of the
 * loop: `npm run record -- --shared-state` in autorecorder/ writes a silent
 * clip, and re-running the whole automation just to hear it is wasteful. It is
 * a thin wrapper on purpose — the mapping and the ffmpeg call live in
 * `ci/lib/mux.mjs` and stay single-sourced.
 *
 * Re-running it is safe: the ffmpeg call maps only the video stream out of the
 * existing clip, so a second run replaces the voiceover rather than layering a
 * second track under it.
 */
import { muxAudioFiles } from './lib/mux.mjs';

muxAudioFiles();

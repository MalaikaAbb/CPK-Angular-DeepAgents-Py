/**
 * Voiceover muxing — the only implementation.
 *
 * This used to exist twice: once here (run per shard) and again in the
 * workflow's consolidate job. In CI both fired, so a shard that recorded
 * Readables got its audio muxed, and consolidate then muxed the same track
 * onto the already-muxed file. Muxing now happens once, where the video is
 * produced; the workflow just installs ffmpeg and lets this run.
 *
 * WebM carries only Vorbis or Opus, and the choice is not free: Windows Media
 * Player renders VP8 fine and has no Opus decoder, so an Opus track plays as
 * silence there with no error and no warning — which is how a correctly muxed
 * clip gets reported as "the video has no audio". Vorbis is decoded by WMP and
 * by every browser, so it is what these are encoded with. Missing ffmpeg
 * is a skip, not a failure: a silent demo still beats no demo.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_DIR, VIDEOS_DIR } from './config.mjs';

/**
 * Which audio track belongs to which video. `videoMatch` is matched against the
 * video filename, which carries the demo name
 * (e.g. `DAPY-angular-07-SharedState.webm`).
 *
 * The mapping is explicit rather than inferred from filenames, so a renamed demo
 * drops its voiceover visibly instead of quietly muxing it onto the wrong clip.
 * All four matches are unique across this repo's `videoName`s.
 *
 * The four tracks live in `autorecorder/audio/` and are shared verbatim with the
 * other Angular repos: the narration is about the CopilotKit concept, not the
 * agent framework behind it, and all of them now run the same handler for these
 * pages, so one recording fits AG2-, AGNO-, MASTRA-, MSPY- and DAPY-angular.
 * Every other clip stays silent and is skipped by this table.
 *
 * Silence is the right default for the four issue clips in particular — they
 * carry their report as on-screen text in a Notepad window, which survives being
 * watched with the sound off.
 *
 * @type {{ audioFile: string, videoMatch: string }[]}
 */
const AUDIO_TRACKS = [
  { audioFile: 'angular-frontendtoolsv1.71.m4a', videoMatch: 'FrontendToolsGenerativeUi' },
  // Both halves of the voice/multimodal clip are narrated: the attachment that
  // works, then the transcription that has no service behind it. The track only
  // lines up with a clip recorded by the current actions/voice.action.ts.
  { audioFile: 'angular- voice and attachments.m4a', videoMatch: 'VoiceMultimodal' },
  { audioFile: 'sharedstate-angular.m4a', videoMatch: 'SharedState' },
  { audioFile: 'thread-angular.m4a', videoMatch: 'Threads' },
];

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function muxAudioFiles() {
  const tracks = AUDIO_TRACKS.filter((t) => fs.existsSync(path.join(AUDIO_DIR, t.audioFile)));
  if (tracks.length === 0) return;
  if (!fs.existsSync(VIDEOS_DIR)) return;

  if (!hasFfmpeg()) {
    console.log('ℹ️ [Audio Mux] ffmpeg not found in PATH; skipping (videos stay silent).');
    return;
  }

  const files = fs.readdirSync(VIDEOS_DIR);

  for (const track of tracks) {
    const audioPath = path.join(AUDIO_DIR, track.audioFile);
    const video = files.find(
      (f) => f.includes(track.videoMatch) && f.endsWith('.webm') && !f.startsWith('temp_'),
    );

    if (!video) {
      console.log(`ℹ️ [Audio Mux] No ${track.videoMatch} video in this run; skipping ${track.audioFile}.`);
      continue;
    }

    const inputPath = path.join(VIDEOS_DIR, video);
    const tempPath = path.join(VIDEOS_DIR, `temp_${video}`);
    console.log(`\n🎵 [Audio Mux] Adding ${track.audioFile} to ${video}...`);

    try {
      // `-af apad` + `-shortest` together pin the output to the VIDEO's length.
      // `-shortest` alone stops at whichever stream ends first, and these
      // narrations are shorter than the clips they describe (45s of audio over
      // a 72s Shared State demo), so the bare flag cut the demo off mid-scene —
      // the same bug the other Angular repos fixed here. apad pads the track
      // with silence and -shortest then stops at the video, which also keeps a
      // track that overruns from extending the clip past its last frame.
      execSync(
        `ffmpeg -y -i "${inputPath}" -i "${audioPath}" -c:v copy -c:a libvorbis -q:a 5 -af apad -map 0:v:0 -map 1:a:0 -shortest "${tempPath}"`,
        { stdio: 'ignore' },
      );
      fs.copyFileSync(tempPath, inputPath);
      fs.unlinkSync(tempPath);
      console.log(`✅ [Audio Mux] Added audio to ${video}`);
    } catch (err) {
      console.warn(`⚠️ [Audio Mux] Could not mux ${track.audioFile}:`, err.message || err);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

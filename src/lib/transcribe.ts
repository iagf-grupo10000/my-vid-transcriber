import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CHUNK_SECONDS = 30;
const HF_API_BASE_PREFIX = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration || 0);
    });
  });
}

function extractSegment(inputPath: string, outputDir: string, startSec: number, durationSec: number, index: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const outPath = path.join(outputDir, `chunk-${String(index).padStart(4, '0')}.wav`);
    ffmpeg(inputPath)
      .setStartTime(startSec).setDuration(durationSec)
      .toFormat('wav').audioChannels(1).audioFrequency(16000)
      .save(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject);
  });
}

async function transcribeChunk(chunkPath: string, chunkIndex: number, chunkSeconds: number): Promise<{ startTime: string; text: string }> {
  const HF_API_BASE = HF_API_BASE_PREFIX;
  try {
    const wavBytes = fs.readFileSync(chunkPath);
    const res = await axios.post(HF_API_BASE, wavBytes, {
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
        'Content-Type': 'audio/wav',
        Accept: 'application/json',
      },
      timeout: 120_000,
    });
    const text = (res.data?.text || '').trim();
    return { startTime: fmtTime(chunkIndex * chunkSeconds), text };
  } catch (e: any) {
    const detail = e.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message;
    throw new Error(`HF API error (chunk ${chunkIndex}): ${detail}`);
  }
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function grammarFix(text: string): Promise<string> {
  if (text.length < 10) return text;
  try {
    const lt = await axios.post('https://api.languagetool.org/v2/check', null, {
      params: { text, language: 'es', enabledOnly: false },
      timeout: 15_000,
    });
    if (!lt.data?.matches) return text;
    let corrected = text;
    const fixes = lt.data.matches
      .filter((m: any) => m.replacements?.length)
      .sort((a: any, b: any) => b.offset - a.offset);
    for (const m of fixes) {
      corrected = corrected.slice(0, m.offset) + m.replacements[0].value + corrected.slice(m.offset + m.length);
    }
    return corrected;
  } catch { return text; }
}

/**
 * Helper compartido: transcribe desde un archivo de audio.
 * Usado por YouTube y subida de archivos locales.
 */
export async function transcribeAudioFile(
  audioPath: string,
  title: string,
  sourceUrl?: string
): Promise<{
  text: string;
  textWithTimestamps: string;
  title: string;
  duration: string;
  chunks: number;
  sourceType: 'youtube' | 'local';
  sourceUrl?: string;
}> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  const session = path.join(tmpRoot, `s-${Date.now()}`);
  const chunksDir = path.join(session, 'chunks');
  for (const d of [tmpRoot, session, chunksDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  try {
    const totalSec = await getAudioDuration(audioPath);
    const totalChunks = Math.ceil(totalSec / CHUNK_SECONDS);
    const results: { startTime: string; text: string }[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const startSec = i * CHUNK_SECONDS;
      const segDuration = Math.min(CHUNK_SECONDS, totalSec - startSec);
      const wavPath = await extractSegment(audioPath, chunksDir, startSec, segDuration, i);
      const result = await transcribeChunk(wavPath, i, CHUNK_SECONDS);
      results.push(result);
      try { fs.unlinkSync(wavPath); } catch {}
      if (i < totalChunks - 1) await new Promise(r => setTimeout(r, 300));
    }

    const rawText = results.map(r => r.text).filter(Boolean).join(' ');
    const correctedText = await grammarFix(rawText);
    const textWithTimestamps = results.filter(r => r.text).map(r => `[${r.startTime}] ${r.text}`).join('\n');

    return {
      text: correctedText,
      textWithTimestamps,
      title: title || 'sin_titulo',
      duration: fmtTime(totalSec),
      chunks: totalChunks,
      sourceType: sourceUrl ? 'youtube' : 'local',
      sourceUrl,
    };
  } finally {
    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}
  }
}

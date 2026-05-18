import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CHUNK_SECONDS = 30;
// Nuevo endpoint Router de HF Inference API (acepta raw audio, no form-data)
const HF_API_BASE = 'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration || 0);
    });
  });
}

function extractSegment(
  inputPath: string,
  outputDir: string,
  startSec: number,
  durationSec: number,
  index: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outPath = path.join(outputDir, `chunk-${String(index).padStart(4, '0')}.wav`);
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .save(outPath)
      .on('end', () => resolve(outPath))
      .on('error', reject);
  });
}

async function downloadAudio(url: string, outputDir: string): Promise<string> {
  const outputTemplate = path.join(outputDir, 'audio.%(ext)s');
  try {
    const { stderr } = await execFileAsync('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '5',
      '--js-runtimes', 'node',
      '-o', outputTemplate, '--no-playlist', '--no-warnings', '--quiet', url,
    ]);
    if (stderr) console.log('yt-dlp stderr:', stderr);
  } catch (e: any) {
    throw new Error(`yt-dlp falló: ${e.message}\n${e.stderr || ''}`);
  }
  const mp3Path = path.join(outputDir, 'audio.mp3');
  if (!fs.existsSync(mp3Path)) {
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp3'));
    if (files.length === 0) throw new Error('No se pudo descargar el audio');
    fs.renameSync(path.join(outputDir, files[0]), mp3Path);
  }
  return mp3Path;
}

/**
 * Transcribe un chunk WAV usando HF Router Inference API.
 * Envía el audio como raw bytes (no form-data) con Content-Type: audio/wav.
 */
async function transcribeChunk(
  chunkPath: string,
  chunkIndex: number,
  chunkSeconds: number
): Promise<{ startTime: string; text: string }> {
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
    const startSec = chunkIndex * chunkSeconds;
    return { startTime: fmtTime(startSec), text };
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
      corrected =
        corrected.slice(0, m.offset) +
        m.replacements[0].value +
        corrected.slice(m.offset + m.length);
    }
    return corrected;
  } catch {
    return text;
  }
}

export async function POST(req: Request) {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  const session = path.join(tmpRoot, `s-${Date.now()}`);
  const chunksDir = path.join(session, 'chunks');

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string' || (!url.startsWith('http') && !url.startsWith('www'))) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    for (const d of [tmpRoot, session, chunksDir]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }

    // 1. Descargar audio con yt-dlp
    console.log('Descargando audio desde YouTube...');
    const audioMp3 = await downloadAudio(url, session);

    // 2. Obtener duración
    const totalSec = await getAudioDuration(audioMp3);
    const totalChunks = Math.ceil(totalSec / CHUNK_SECONDS);
    console.log(`Duración: ${fmtTime(totalSec)} (${totalChunks} fragmentos)`);

    // 3. Procesar cada segmento
    const results: { startTime: string; text: string }[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const startSec = i * CHUNK_SECONDS;
      const segDuration = Math.min(CHUNK_SECONDS, totalSec - startSec);

      console.log(`  Segmento ${i + 1}/${totalChunks} [${fmtTime(startSec)}]`);

      const wavPath = await extractSegment(audioMp3, chunksDir, startSec, segDuration, i);
      const result = await transcribeChunk(wavPath, i, CHUNK_SECONDS);
      results.push(result);

      try { fs.unlinkSync(wavPath); } catch {}

      if (i < totalChunks - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // 4. Combinar
    const rawText = results.map(r => r.text).filter(Boolean).join(' ');
    const correctedText = await grammarFix(rawText);

    const textWithTimestamps = results
      .filter(r => r.text)
      .map(r => `[${r.startTime}] ${r.text}`)
      .join('\n');

    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}

    return NextResponse.json({
      text: correctedText,
      textWithTimestamps,
      duration: fmtTime(totalSec),
      chunks: totalChunks,
    });
  } catch (error: any) {
    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}
    console.error('Error:', error.message);
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }
}

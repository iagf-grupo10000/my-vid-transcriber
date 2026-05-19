import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ─── Configuración vía variables de entorno ──────────────────────────────
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'es';
const WHISPER_BEAM_SIZE = parseInt(process.env.WHISPER_BEAM_SIZE || '5', 10);
const WHISPER_DEVICE = process.env.WHISPER_DEVICE || 'cpu';
const LANGUAGETOOL_ENABLED = process.env.LANGUAGETOOL_ENABLED !== 'false';

/**
 * Convierte cualquier archivo de audio/video a WAV 16kHz mono,
 * formato óptimo para faster-whisper.
 */
function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Transcribe un archivo de audio llamando al bridge Python (faster-whisper local).
 * Retorna el JSON parseado con segmentos, texto completo y metadatos.
 */
async function transcribeWithPython(audioPath: string): Promise<LocalTranscriptionResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_local.py');

  const args = [
    scriptPath,
    audioPath,
    '--model', WHISPER_MODEL,
    '--language', WHISPER_LANGUAGE,
    '--beam-size', String(WHISPER_BEAM_SIZE),
    '--device', WHISPER_DEVICE,
  ];

  const { stdout, stderr } = await execFileAsync('python3', args, { timeout: 600_000 });

  // stderr contiene logs de progreso (model loading, timing)
  for (const line of stderr.split('\n').filter(Boolean)) {
    try {
      const evt = JSON.parse(line);
      if (evt.event) console.log(`[whisper] ${evt.event}:`, JSON.stringify(evt));
    } catch {
      // No es JSON, ignorar
    }
  }

  const result: LocalTranscriptionResult = JSON.parse(stdout);

  if (!result.success) {
    throw new Error(`Transcripción local falló: ${result.error || 'error desconocido'}`);
  }

  return result;
}

interface LocalSegment {
  start: number;
  end: number;
  text: string;
}

interface LocalTranscriptionResult {
  success: boolean;
  error?: string;
  model: string;
  language: string;
  language_probability: number;
  duration_seconds: number | null;
  processing_seconds: number;
  num_segments: number;
  segments: LocalSegment[];
  text: string;
  text_with_timestamps: string;
}

/**
 * Corrección gramatical opcional vía LanguageTool API.
 * Deshabilitar con LANGUAGETOOL_ENABLED=false
 */
async function grammarFix(text: string): Promise<string> {
  if (!LANGUAGETOOL_ENABLED || text.length < 10) return text;
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
  } catch {
    return text;
  }
}

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Helper compartido: transcribe desde un archivo de audio.
 * Usado por YouTube y subida de archivos locales.
 * Ahora usa faster-whisper LOCAL en vez de Hugging Face API.
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
  model: string;
  language: string;
  processingSeconds: number;
}> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  const session = path.join(tmpRoot, `s-${Date.now()}`);
  const wavPath = path.join(session, 'audio_16khz.wav');

  for (const d of [tmpRoot, session]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  try {
    // 1. Convertir el audio completo a WAV 16kHz mono (formato óptimo para Whisper)
    console.log(`[whisper] Convirtiendo a WAV 16kHz: ${audioPath}`);
    await convertToWav(audioPath, wavPath);

    // 2. Transcribir localmente con faster-whisper (sin chunking ni HF API)
    console.log(`[whisper] Transcribiendo localmente (modelo: ${WHISPER_MODEL})...`);
    const result = await transcribeWithPython(wavPath);

    // 3. Corrección gramatical opcional
    const textToFix = result.text;
    const correctedText = textToFix ? await grammarFix(textToFix) : '';

    return {
      text: correctedText,
      textWithTimestamps: result.text_with_timestamps,
      title: title || 'sin_titulo',
      duration: fmtTime(result.duration_seconds || 0),
      chunks: result.num_segments,
      sourceType: sourceUrl ? 'youtube' : 'local',
      sourceUrl,
      model: result.model,
      language: result.language,
      processingSeconds: result.processing_seconds,
    };
  } finally {
    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}
  }
}

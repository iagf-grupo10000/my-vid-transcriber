import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { transcribeAudioFile } from '@/lib/transcribe';

const execFileAsync = promisify(execFile);

async function getYoutubeTitle(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--print', 'title', '--no-warnings', url]);
    return stdout.trim();
  } catch {
    return 'video_sin_titulo';
  }
}

async function downloadAudio(url: string, outputDir: string): Promise<string> {
  const outputTemplate = path.join(outputDir, 'audio.%(ext)s');
  try {
    await execFileAsync('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '5',
      '--js-runtimes', 'node',
      '-o', outputTemplate, '--no-playlist', '--no-warnings', '--quiet', url,
    ]);
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

    const videoTitle = await getYoutubeTitle(url);
    const audioMp3 = await downloadAudio(url, session);
    const result = await transcribeAudioFile(audioMp3, videoTitle, url);

    return NextResponse.json(result);
  } catch (error: any) {
    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}
    console.error('Error:', error.message);
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }
}

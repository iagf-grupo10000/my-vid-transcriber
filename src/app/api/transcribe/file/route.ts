import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { transcribeAudioFile } from '@/lib/transcribe';

export async function POST(req: Request) {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  const session = path.join(tmpRoot, `upload-${Date.now()}`);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isAudio = fileName.endsWith('.mp3') || fileName.endsWith('.wav') || fileName.endsWith('.m4a')
      || fileName.endsWith('.flac') || fileName.endsWith('.ogg') || fileName.endsWith('.webm');
    const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.mpeg') || fileName.endsWith('.avi')
      || fileName.endsWith('.mov') || fileName.endsWith('.mkv');

    if (!isAudio && !isVideo) {
      return NextResponse.json({
        error: 'Formato no soportado. Usa: MP3, WAV, M4A, FLAC, OGG, MP4, MPEG, AVI, MOV, MKV',
      }, { status: 400 });
    }

    if (!fs.existsSync(tmpRoot)) fs.mkdirSync(tmpRoot, { recursive: true });
    if (!fs.existsSync(session)) fs.mkdirSync(session, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || '.mp3';
    const uploadPath = path.join(session, `input${ext}`);
    fs.writeFileSync(uploadPath, buffer);

    const title = path.basename(file.name, ext).replace(/[_-]/g, ' ').trim() || 'archivo_local';

    const result = await transcribeAudioFile(uploadPath, title);

    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}

    return NextResponse.json(result);
  } catch (error: any) {
    try { fs.rmSync(session, { recursive: true, force: true }); } catch {}
    console.error('Upload error:', error.message);
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }
}

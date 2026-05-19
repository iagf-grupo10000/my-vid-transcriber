import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const EXPORTS_ROOT = path.join(process.cwd(), 'exports');

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').slice(0, 100);
}

function generateTxt(data: ExportPayload): string {
  return [
    `Título: ${data.title}`,
    `Duración: ${data.duration || '?'}`,
    `Fuente: ${data.sourceUrl || 'Archivo local'}`,
    `Fecha: ${new Date().toLocaleString('es-ES')}`,
    `Fragmentos: ${data.chunks || '?'}`,
    '',
    '═'.repeat(60),
    '',
    data.text,
    '',
    '═'.repeat(60),
    '',
    'Generado por my-vid-transcriber · Whisper IA + LanguageTool',
  ].join('\n');
}

function generateMd(data: ExportPayload): string {
  return `# ${data.title}

**Duración:** ${data.duration || '?'}
**Fuente:** ${data.sourceUrl || 'Archivo local'}
**Fecha:** ${new Date().toLocaleString('es-ES')}
**Fragmentos:** ${data.chunks || '?'}

---

## Transcripción

${data.text}

---

## Transcripción con timestamps

\`\`\`
${data.textWithTimestamps || data.text}
\`\`\`

---

*Generado por [my-vid-transcriber](https://github.com/iagf-grupo10000/my-vid-transcriber) · Whisper IA + LanguageTool*
`;
}

async function generatePdf(data: ExportPayload): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]); // A4
  const { width, height } = page.getSize();
  let y = height - 60;

  const ACCENT = rgb(37 / 255, 99 / 255, 235 / 255);
  const TEXT_COLOR = rgb(31 / 255, 41 / 255, 55 / 255);
  const MUTED = rgb(156 / 255, 163 / 255, 175 / 255);
  const BLACK = rgb(0, 0, 0);

  const writeLine = (text: string, opts: { size?: number; font?: typeof font; color?: typeof TEXT_COLOR; center?: boolean } = {}) => {
    const f = opts.font || font;
    const s = opts.size || 10;
    const c = opts.color || TEXT_COLOR;
    if (y < 60) {
      // New page
      const p = doc.addPage([612, 792]);
      y = p.getSize().height - 60;
    }
    if (opts.center) {
      const tw = f.widthOfTextAtSize(text, s);
      page.drawText(text, { x: (width - tw) / 2, y, size: s, font: f, color: c });
    } else {
      page.drawText(text, { x: 60, y, size: s, font: f, color: c });
    }
    y -= s * 1.5;
  };

  // Título
  writeLine(data.title, { size: 24, font: fontBold, color: ACCENT, center: true });
  y -= 10;

  // Metadatos
  writeLine(`Duración: ${data.duration || '?'}`, { size: 10, color: MUTED, center: true });
  writeLine(`Fuente: ${data.sourceUrl || 'Archivo local'}`, { size: 9, color: MUTED, center: true });
  writeLine(`Fecha: ${new Date().toLocaleString('es-ES')}`, { size: 9, color: MUTED, center: true });
  writeLine(`Fragmentos: ${data.chunks || '?'}`, { size: 9, color: MUTED, center: true });
  y -= 10;

  // Línea
  page.drawLine({ start: { x: 60, y }, end: { x: 552, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 15;

  // Cuerpo
  const body = data.textWithTimestamps || data.text;
  for (const line of body.split('\n')) {
    const tsMatch = line.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*(.*)/);
    if (tsMatch) {
      writeLine(tsMatch[1] + ' ' + tsMatch[2], { size: 9, color: ACCENT });
    } else {
      writeLine(line, { size: 9, color: TEXT_COLOR });
    }
    if (y < 60) {
      const p = doc.addPage([612, 792]);
      y = p.getSize().height - 60;
    }
  }

  // Footer
  y -= 20;
  page.drawLine({ start: { x: 60, y }, end: { x: 552, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 15;
  writeLine('Generado por my-vid-transcriber · Whisper IA (Hugging Face) + LanguageTool', { size: 8, color: MUTED, center: true });

  return Buffer.from(await doc.save());
}

interface ExportPayload {
  text: string;
  textWithTimestamps?: string;
  title: string;
  duration?: string;
  chunks?: number;
  sourceUrl?: string;
}

export async function POST(req: Request) {
  try {
    const data: ExportPayload & { formats?: string[] } = await req.json();
    if (!data.text || !data.title) {
      return NextResponse.json({ error: 'Faltan datos: text y title son requeridos' }, { status: 400 });
    }

    const safeTitle = sanitizeFilename(data.title);
    const now = new Date().toISOString().slice(0, 10);
    const baseName = `${safeTitle}_${now}`;
    const formats = data.formats || ['txt', 'md', 'pdf'];
    const results: { format: string; path: string; url: string }[] = [];

    for (const fmt of formats) {
      const dir = path.join(EXPORTS_ROOT, fmt);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${baseName}.${fmt}`);

      switch (fmt) {
        case 'txt':
          fs.writeFileSync(filePath, generateTxt(data), 'utf-8');
          break;
        case 'md':
          fs.writeFileSync(filePath, generateMd(data), 'utf-8');
          break;
        case 'pdf': {
          const pdfBuf = await generatePdf(data);
          fs.writeFileSync(filePath, pdfBuf);
          break;
        }
        default:
          return NextResponse.json({ error: `Formato no soportado: ${fmt}` }, { status: 400 });
      }
      results.push({ format: fmt, path: filePath, url: `/api/export/download?file=${encodeURIComponent(filePath)}` });
    }

    return NextResponse.json({ success: true, title: data.title, files: results, baseName });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: `Error al exportar: ${error.message}` }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('file');

    if (!filePath) {
      return NextResponse.json({ error: 'Parámetro "file" requerido' }, { status: 400 });
    }

    // Validación de seguridad: solo permitir archivos dentro del directorio exports/
    const exportsDir = path.join(process.cwd(), 'exports');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(exportsDir)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const buffer = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const baseName = path.basename(resolved);

    const contentTypes: Record<string, string> = {
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.pdf': 'application/pdf',
    };

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

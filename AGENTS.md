# my-vid-transcriber — Agent Guide

## Stack
- **Frontend/API:** Next.js 16 (TypeScript) en puerto 5000
- **Runtime:** Node.js 18+ (por defecto), Bun 1.3+ como gestor de paquetes y alternativo
- **Package manager:** Bun (bun install ~5x más rápido que npm)
- **Transcripción:** faster-whisper (Python) vía subprocess — 100% local, SIN Hugging Face
- **Export:** txt, md, pdf (pdf-lib)
- **Audio:** ffmpeg, yt-dlp (con --js-runtimes node)

## Arquitectura de transcripción

```
Next.js API Route → transcribeAudioFile() → Python bridge (transcribe_local.py)
                                                ↓
                                         faster-whisper
                                          (modelo local)
                                                ↓
                                         JSON con segmentos
                                                ↓
                                    LanguageTool (opcional, deshabilitable)
                                                ↓
                                    Retorna resultado al frontend
```

## Variables de entorno clave
- WHISPER_MODEL=base (tiny/base/small/medium/large-v3)
- WHISPER_LANGUAGE=es
- WHISPER_DEVICE=cpu (o cuda si hay GPU compatible)
- LANGUAGETOOL_ENABLED=true

## Dependencias Python
- faster-whisper (CTranslate2 backend, int8 en CPU)
- soundfile

## Estado actual (mayo 2026)
- Transcripción 100% local: ✅
- GPU no usable (driver 470/CUDA 11.4 vs torch CUDA 12.8)
- Pipeline Go planificado como próxima fase (ver docs/go_analysis.md)

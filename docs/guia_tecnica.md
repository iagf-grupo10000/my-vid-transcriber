# Guía Técnica — my-vid-transcriber

Arquitectura, componentes, configuración avanzada y mantenimiento.

---

## 1. Arquitectura general

```
                     ┌──────────────────────────────────────┐
                     │          Next.js 16 (puerto 5000)     │
                     │                                      │
  Usuario ─────►     │  ┌──────────┐    ┌────────────────┐  │
                     │  │ Frontend │    │  API Routes     │  │
                     │  │ (React)  │    │                │  │
                     │  └──────────┘    │ • /api/transcribe   │
                     │       │         │ • /api/transcribe/file │
                     │       │         │ • /api/export     │
                     │       │         └────────┬───────────┘  │
                     └───────┼──────────────────┼──────────────┘
                             │                  │
                             ▼                  ▼
                     ┌──────────────────────────────────────┐
                     │          transcribeAudioFile()       │
                     │          src/lib/transcribe.ts        │
                     │                                      │
                     │  1. Convertir audio a WAV 16kHz mono │
                     │  2. Ejecutar Python bridge            │
                     │  3. (Opcional) LanguageTool API       │
                     │  4. Retornar JSON con segmentos       │
                     └────────────────┬─────────────────────┘
                                      │ execFile('python3', ...)
                                      ▼
                     ┌──────────────────────────────────────┐
                     │   scripts/transcribe_local.py        │
                     │   (faster-whisper, CPU int8)          │
                     │                                      │
                     │  1. Cargar modelo (cacheado)         │
                     │  2. Transcribir audio completo        │
                     │  3. Retornar JSON por stdout          │
                     └──────────────────────────────────────┘
```

---

## 2. Componentes

### 2.1 Frontend (`src/app/page.tsx`)
- Interfaz React con selector de archivos y campo de URL
- Comunicación con API Routes via fetch

### 2.2 API Routes

| Ruta | Método | Función |
|------|--------|---------|
| `/api/transcribe` | POST | Transcribe URL de YouTube |
| `/api/transcribe/file` | POST | Transcribe archivo subido |
| `/api/export` | POST | Exporta a txt/md/pdf |
| `/api/export/download` | GET | Descarga archivo exportado |

### 2.3 Orquestador (`src/lib/transcribe.ts`)
- `transcribeAudioFile()` — función principal
- `convertToWav()` — ffmpeg wrapper para conversión a 16kHz mono
- `transcribeWithPython()` — ejecuta el bridge Python
- `grammarFix()` — corrección gramatical opcional (LanguageTool API)

### 2.4 Bridge Python (`scripts/transcribe_local.py`)
- Usa `faster-whisper` con CTranslate2
- Cachea el modelo en memoria (TTL: 5 minutos)
- Exporta JSON con segmentos, timestamps, y metadatos
- Soporta los modelos: tiny, base, small, medium, large-v3

### 2.5 Export (`src/app/api/export/route.ts`)
- Genera `.txt` con texto plano + metadatos
- Genera `.md` con Markdown estructurado
- Genera `.pdf` con pdf-lib (fuente Helvetica, timestamps coloreados)

---

## 3. Flujo de datos detallado

### YouTube
```
URL → yt-dlp → audio.mp3 → ffmpeg → audio_16khz.wav → Python bridge → JSON
```

### Archivo local
```
File upload (multipart) → buffer → ffmpeg → audio_16khz.wav → Python bridge → JSON
```

### Post-procesamiento
```
JSON.segments → texto plano → (opcional) LanguageTool → texto corregido
               → texto con timestamps → Export (txt/md/pdf)
```

---

## 4. Configuración avanzada

### 4.1 Variables de entorno

| Variable | Default | Valores | Descripción |
|----------|---------|---------|-------------|
| `WHISPER_MODEL` | `base` | `tiny`,`base`,`small`,`medium`,`large-v3` | Modelo de transcripción |
| `WHISPER_LANGUAGE` | `es` | ISO 639-1 o `auto` | Idioma del audio |
| `WHISPER_DEVICE` | `cpu` | `cpu`,`cuda` | Dispositivo de inferencia |
| `WHISPER_BEAM_SIZE` | `5` | `1`-`5` | Precisión del beam search |
| `LANGUAGETOOL_ENABLED` | `true` | `true`,`false` | Corrección gramatical |
| `HUGGINGFACE_TOKEN` | — | string | Solo para compatibilidad con HF |

### 4.2 Archivo `.env.local`
Se carga automáticamente por Next.js en desarrollo. No se commitea.

### 4.3 Archivo `.env.example`
Plantilla con valores por defecto. Se commitea como referencia.

---

## 5. Dependencias

### Node.js / Bun
```
@ffmpeg-installer/ffmpeg  → Binario ffmpeg
fluent-ffmpeg             → Wrapper Node.js para ffmpeg
axios                     → HTTP client (LanguageTool)
pdf-lib                   → Generación de PDF
next                      → Framework web
ytdl-core                 → Metadatos de YouTube (no usado para descarga)
```

### Python
```
faster-whisper            → Transcripción local (CTranslate2 + int8)
soundfile                 → Soporte de archivos de audio
```

### Sistema
```
ffmpeg                    → Conversión de audio/video
yt-dlp                    → Descarga de YouTube
python3                   → Runtime Python
bun                       → Gestor de paquetes (alternativo: npm)
```

---

## 6. Mantenimiento

### 6.1 Actualizar dependencias
```bash
bun install              # JavaScript
pip install -r requirements.txt --upgrade  # Python
```

### 6.2 Limpiar caché de transcripciones
```bash
rm -rf tmp/              # Archivos temporales de audio
rm -rf exports/          # Archivos exportados
```

### 6.3 Reconstruir desde cero
```bash
rm -rf node_modules bun.lock tmp .next
bun install
bun run build
```

### 6.4 Forzar recarga de modelo Whisper
```bash
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-*
# La próxima ejecución lo descargará de nuevo
```

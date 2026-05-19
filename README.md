# my-vid-transcriber 🎤

Transcripción de videos (YouTube y archivos locales) a texto con timestamps.
Exporta a `.txt`, `.md` y `.pdf`.

## 🚀 Características

- **Transcripción 100% local** — usa faster-whisper en CPU/GPU, sin depender de APIs externas
- **Soporta YouTube** — descarga el audio automáticamente con yt-dlp
- **Soporta archivos locales** — MP3, WAV, M4A, FLAC, OGG, WebM, MP4, MPEG, AVI, MOV, MKV
- **Exporta a 3 formatos** — `.txt`, `.md` y `.pdf` simultáneamente
- **Timestamps** — cada fragmento con su marca de tiempo
- **Corrección gramatical opcional** — vía LanguageTool (deshabilitable)

## 📋 Requisitos

- **Node.js** 18+
- **Python 3.9+** con pip
- **ffmpeg** (para conversión de audio)
- **yt-dlp** (para videos de YouTube, opcional)
- **faster-whisper** (se instala automáticamente con `pip install -r requirements.txt`)
- **Bun** (gestor de paquetes — instalación 5x más rápida que npm)

## 🔧 Instalación

```bash
# 1. Clonar repositorio
git clone git@github.com:iagf-grupo10000/my-vid-transcriber.git
cd my-vid-transcriber

# 2. Instalar dependencias Node.js (vía Bun)
bun install

# 3. Instalar dependencias Python (transcripción local)
pip install -r requirements.txt

# 4. Copiar configuración
cp .env.example .env.local

# 5. Iniciar servidor (usando Node.js como runtime, Bun como gestor)
bun run dev
```

La app corre en **http://localhost:5000**

> 💡 **Sobre Bun:** Se usa principalmente como gestor de paquetes (`bun install` es ~5x más rápido que `npm install`) y para scripts. El runtime por defecto sigue siendo Node.js para máxima compatibilidad con Next.js 16. Para probar con Bun como runtime, usa `bun run dev:bun`.

## ⚙️ Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `WHISPER_MODEL` | `base` | Modelo: tiny, base, small, medium, large-v3 |
| `WHISPER_LANGUAGE` | `es` | Idioma: es, en, pt, fr, auto |
| `WHISPER_BEAM_SIZE` | `5` | Beam search: 1-5 (mayor = más preciso) |
| `WHISPER_DEVICE` | `cpu` | Dispositivo: cpu o cuda |
| `LANGUAGETOOL_ENABLED` | `true` | Corrección gramatical (true/false) |

## 🧠 Modelos Whisper

| Modelo | Tamaño | Velocidad (CPU i5-4590) | Precisión |
|--------|--------|------------------------|-----------|
| tiny | ~150 MB | ~3x tiempo real | Básica |
| base | ~300 MB | ~2x tiempo real | Buena |
| small | ~950 MB | ~1x tiempo real | Muy buena |
| medium | ~3 GB | ~0.5x tiempo real | Excelente |
| large-v3 | ~6 GB | ~0.2x tiempo real | Máxima |

**Recomendación:** `base` para uso diario, `small` cuando necesites máxima precisión.

## 🗺️ Roadmap

- [x] Transcripción 100% local (faster-whisper, sin Hugging Face)
- [ ] Backend Go como orquestador (chunking paralelo, ver `docs/go_analysis.md`)
- [ ] Corrección gramatical local (spaCy/stanza en vez de LanguageTool API)
- [ ] Progreso en tiempo real vía SSE
- [ ] Cola de transcripciones concurrentes

## 📁 Estructura

```
├── scripts/
│   └── transcribe_local.py   # Bridge Python (faster-whisper)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── transcribe/    # API de transcripción (YouTube)
│   │   │   ├── transcribe/file/  # API de transcripción (archivos)
│   │   │   └── export/        # API de exportación (txt/md/pdf)
│   │   └── page.tsx           # Frontend
│   └── lib/
│       └── transcribe.ts      # Lógica de transcripción (orquestador)
├── exports/                   # Archivos exportados
│   ├── txt/
│   ├── md/
│   └── pdf/
└── docs/
    └── go_analysis.md         # Análisis de Go como backend
```

## 📜 Licencia

MIT — IAGF-Grupo10000

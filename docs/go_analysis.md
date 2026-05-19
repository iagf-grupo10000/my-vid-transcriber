# Análisis de Go (Golang) para my-vid-transcriber

**Fecha:** 19 de mayo de 2026
**Contexto:** Proyecto my-vid-transcriber (Next.js 16 + Python faster-whisper)
**Hardware:** Linux, Intel i5-4590, NVIDIA GPU (driver 470/CUDA 11.4)
**Objetivo:** Independencia total de APIs externas (Hugging Face)

---

## 1. Filosofía y características de Go

### 1.1 Principios de diseño
- **Simplicidad**: Sin herencia de clases, sin excepciones, sin sobrecarga de operadores
- **Composición sobre herencia**: Interfaces implícitas, embedding de structs
- **Explícito sobre implícito**: Errores como valores (`if err != nil`), sin unchecked exceptions
- **Un estilo obligatorio**: `gofmt` — un solo formateador oficial, cero debates de estilo
- **Compilación rápida**: Compila a código nativo en segundos, incluso proyectos grandes
- **Tipado estático con inferencia**: Seguridad de tipos sin verbosidad excesiva

### 1.2 Concurrencia (punto más relevante)
| Concepto | Go | TypeScript (Node.js) |
|----------|-----|---------------------|
| Modelo | Goroutines (green threads) | Event loop (1 thread) |
| Peso | ~4 KB stack inicial | ~1 MB por thread OS |
| Escalabilidad | Millones de goroutines | ~1 thread principal |
| Comunicación | Channels (CSP) | Callbacks/Promises |
| Paralelismo real | Sí (GOMAXPROCS) | No (single thread) |

### 1.3 Toolchain
- **Cross-compile nativo**: `GOOS=linux GOARCH=amd64 go build`
- **Binario estático**: Sin dependencias del SO (single binary)
- **Módulos**: `go mod init`, `go mod tidy` (versionado semántico)

---

## 2. Interoperabilidad Go ↔ Python

| Método | Latencia | Complejidad | Cross-platform | Recomendación |
|--------|----------|-------------|----------------|---------------|
| Subprocesos (stdin/stdout) | Media | Baja | Total | **MVP** |
| gRPC | Baja | Media | Total | **Producción** |
| gopy (.so CPython) | Muy baja | Alta | Limitada | Nicho |
| cgo directo | Baja | Muy alta | Limitada | No |
| c-shared + ctypes | Baja | Alta | Limitada | Nicho |

**Recomendación**: Subprocesos vía `exec.CommandContext` para MVP, gRPC para producción.

---

## 3. Interoperabilidad Go ↔ JavaScript/TypeScript

| Método | Latencia | Complejidad | Recomendación |
|--------|----------|-------------|---------------|
| Subprocesos (Node → Go) | Media | Baja | **MVP+Producción** |
| gRPC-web | Baja | Media | **Producción** |
| Go WASM | Alta (binarios 2-15MB) | Media | No recomendado |
| TinyGo WASM | Media | Alta | Edge computing |
| Node.js FFI (koffi) | Muy baja | Alta | Nicho |

**Recomendación**: Subprocesos (Node ejecuta binario Go) para la mayoría de casos.

---

## 4. Aplicación al proyecto: Arquitectura híbrida propuesta

```
┌──────────────────┐     HTTP/JSON     ┌──────────────────┐     exec.Command    ┌──────────────────┐
│   TypeScript     │◄──────────────────►│   Go Backend     │────────────────────►│   Python Worker  │
│   (Next.js 16)   │                    │   (Orquestador)  │    stdin/stdout     │  (faster-whisper) │
│                  │                    │                  │                     │                  │
│ • Frontend       │                    │ • API HTTP       │                     │ • ML inference   │
│ • PDF export     │                    │ • Worker pool    │                     │ • GPU (si CUDA)  │
│ • Upload UI      │                    │ • ffmpeg wrapper │                     │ • Post-proc NLP  │
│ • Result UI      │                    │ • Chunking ▸▸▸   │                     │                  │
│                  │                    │ • yt-dlp         │                     │                  │
└──────────────────┘                    │ • Cache          │                     └──────────────────┘
                                        │ • Logging        │
                                        └──────────────────┘
```

### Beneficios por componente
| Componente | Tipo actual | Propuesta | Beneficio |
|-----------|-------------|-----------|-----------|
| ffmpeg wrapper | fluent-ffmpeg (Node.js) | `os/exec` en Go | Más rápido, pipe streaming |
| Chunking | Secuencial (for+await) | Goroutines paralelas | 3-4x más rápido (4 cores) |
| API HTTP | Next.js Routes | `net/http` en Go | Mayor throughput, servidor dedicado |
| Comunicación Python | No existe | exec.CommandContext | Whisper local sin HF |
| Distribución | npm + node_modules | Binario único | Mucho más simple |

### Lo que NO cambia
- **Python**: faster-whisper (ecosistema ML)
- **TypeScript**: Frontend React, export PDF (ecosistema web)

---

## 5. Multiplataforma

| Aspecto | Go | Python | Node.js |
|---------|-----|--------|---------|
| Distribución | 1 binario estático | Código + venv + paquetes | Código + node_modules |
| Docker image | 5 MB (scratch) | >200 MB (python:3.11-slim) | >150 MB (node:20) |
| Cross-compile | `GOOS=windows go build` | No nativo | No existe |
| Arranque | < 1 ms | ~500 ms (con imports) | ~200-500 ms |
| Memoria base | ~5 MB | ~30 MB | ~30 MB |

---

## 6. Roadmap sugerido

**Fase 0 (Inmediata):** Migrar HF API → faster-whisper local (Python bridge)
**Fase 1 (Corto plazo):** Backend Go como orquestador (chunking paralelo, ffmpeg wrapper)
**Fase 2 (Mediano plazo):** gRPC, caché, SSE para progreso en tiempo real

---

## 7. Conclusión

**Go es altamente recomendable** como orquestador backend para my-vid-transcriber.
No reemplaza Python (ML) ni TypeScript (frontend), sino que actúa como backbone
de concurrencia y distribución multiplataforma entre ambos.

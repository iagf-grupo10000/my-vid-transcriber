# Evaluación de Bun (bun.sh) para my-vid-transcriber

**Fecha:** 19 de mayo de 2026
**Versión evaluada:** Bun v1.3.14 (13 de mayo 2026)
**Proyecto:** my-vid-transcriber (Next.js 16 + TypeScript + Python faster-whisper)
**Sistema:** Linux, Intel i5-4590, kernel 6.8

---

## 1. ¿Qué es Bun?

Runtime **all-in-one** para JavaScript/TypeScript creado por **Jarred Sumner** (Oven.sh). Escrito en **Zig**, usa **JavaScriptCore** (WebKit/Safari) en vez de V8 (Chrome/Node.js).

Reemplaza en un solo binario: Node.js + npm + npx + ts-node + Jest + esbuild.

---

## 2. Tabla comparativa Node.js vs Bun

| Aspecto | Node.js 18+ | Bun v1.3.14 | Impacto en my-vid-transcriber |
|---------|-------------|-------------|-------------------------------|
| **Runtime engine** | V8 | JavaScriptCore | Diferencias en microtask scheduling |
| **Package manager** | npm (20-30s install) | bun install (3-5s) | 5-6x más rápido |
| **TypeScript** | Necesita tsc/SWC | Nativo, ejecuta .ts directo | Reduce build step |
| **SQLite** | better-sqlite3 (externo) | bun:sqlite built-in | Caché de transcripciones built-in |
| **Fetch** | axios/node-fetch | Nativo (Web API) | Podrías eliminar axios |
| **child_process** | Completo | 92% de tests pasan | execFile/spawn funcionan |
| **Next.js 16** | 100% soporte | vía `bun --bun` — no probado a fondo con 16.x | Riesgo de bugs |
| **RAM** | ~50-80 MB | ~15-30 MB | ~40-50% menos RAM |
| **Startup** | ~100-200ms | ~10-20ms | Desarrollo más ágil |

---

## 3. Compatibilidad con dependencias del proyecto

| Dependencia | ¿Funciona en Bun? | Detalle |
|-------------|-------------------|---------|
| **fluent-ffmpeg** | SI | Usa child_process.spawn — Bun lo implementa |
| **pdf-lib** | SI | JS puro, sin native modules |
| **axios** | SI | Funciona. Bun también tiene fetch nativo |
| **child_process (execFile)** | SI | Bun implementa node:child_process |
| **fs (sync/async)** | SI | node:fs — 92% de tests de Node pasan |
| **path** | SI | 100% compatible |
| **next/server** | SI | Funciona con `bun --bun` |
| **yt-dlp subprocess** | SI | execFile contra binario externo funciona |

**Ninguna dependencia usa native addons (node-gyp).** Todas son JS puro. La compatibilidad es alta.

---

## 4. Ventajas específicas para my-vid-transcriber

1. **bun install** en ~3s vs npm install en ~20-30s
2. **bun:sqlite** built-in — permitiría implementar caché de transcripciones local sin instalar nada extra
3. **Fetch nativo** — podrías eliminar axios de las dependencias
4. **Bun.file()** — lectura/escritura más rápida de archivos de audio que fs.readFileSync
5. **TypeScript nativo** — scripts auxiliares sin paso de compilación

---

## 5. Desventajas y riesgos

1. **Next.js 16 + Bun no está suficientemente probado.** Issues potenciales con React Server Components, Server Actions, y streaming SSR.
2. **Ecosistema más joven** (~3 años vs 30+ de Node.js).
3. **Debugging** menos maduro (sin clinic.js, ndb, 0x).
4. **Breaking changes** entre versiones minor (Bun aún no es tan estable como Node LTS).
5. **Windows** es reciente (no aplica — usas Linux).

---

## 6. Recomendación: Migración PARCIAL

**NO migres completamente a Bun ahora.** El cuello de botella real de la app es faster-whisper (Python) y ffmpeg, no Node.js. La ganancia marginal no justifica el riesgo.

### Fase 1: Bun como gestor de paquetes (inmediato)
```bash
curl -fsSL https://bun.sh/install | bash   # No afecta Node.js
cd ~/Documentos/mcp/yt-transcriber
bun install                                 # 3-5s vs 20-30s de npm
bun run dev                                 # arranca con Node.js (sin --bun)
```

### Fase 2: Bun para scripts (desarrollo diario)
- `bun run build` — build más rápido
- `bun run lint` — lint más rápido
- `bun run <script>` — scripts auxiliares sin esperar npm

### Fase 3: Evaluar Bun para API routes (futuro)
- Probar `bun --bun next dev` periódicamente
- Migrar completamente solo cuando Bun v2+ tenga soporte probado para Next.js 16 LTS

### Señales para migrar completamente
- Bun v2.0 estable con Next.js 16 LTS probado por la comunidad
- Necesidad real de `bun:sqlite` para caché masiva de transcripciones
- Issues de React Server Components cerrados

---

## 7. Pasos concretos para probar sin riesgo

```bash
# 1. Instalar Bun
curl -fsSL https://bun.sh/install | bash

# 2. Verificar instalación
bun --version

# 3. Instalar dependencias con Bun (crea bun.lock, no toca package-lock.json)
cd ~/Documentos/mcp/yt-transcriber
bun install

# 4. Probar Next.js con Node.js (usando dependencias instaladas por Bun)
bun run dev     # Usa Node.js para next dev, Bun solo como gestor

# 5. (Opcional) Probar Next.js con Bun
bun --bun next dev -p 5000

# Para revertir: solo borrar bun.lock y volver a npm install
```

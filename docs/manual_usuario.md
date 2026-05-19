# Manual de Usuario — my-vid-transcriber

## ¿Qué hace esta aplicación?

Transcribe el audio de videos (YouTube o archivos locales) a texto escrito.
Genera archivos en tres formatos: **.txt**, **.md** (Markdown) y **.pdf**.

---

## 1. Iniciar la aplicación

```bash
cd ~/Documentos/mcp/yt-transcriber
bun run dev
```

Abrir en el navegador: **http://localhost:5000**

---

## 2. Transcribir un video de YouTube

1. Copia la URL del video de YouTube
2. Pégala en el campo de texto
3. Presiona el botón de transcripción
4. Espera mientras se descarga y procesa el audio
5. Al terminar, podrás descargar los archivos .txt, .md y .pdf

**Tiempo estimado:** 2-3 minutos para un video de 10 minutos.

---

## 3. Transcribir un archivo local

Formatos soportados:
- **Audio:** MP3, WAV, M4A, FLAC, OGG, WebM
- **Video:** MP4, MPEG, AVI, MOV, MKV

1. Selecciona el archivo desde tu computadora
2. Presiona el botón de transcripción
3. Espera mientras se procesa
4. Descarga los archivos generados

---

## 4. Exportar resultados

Cada transcripción genera automáticamente tres archivos:

| Formato | Contenido | Uso |
|---------|-----------|-----|
| `.txt` | Texto plano con metadatos | Edición general, compartir |
| `.md` | Markdown con timestamps en bloque de código | Documentación, Notion, GitHub |
| `.pdf` | PDF profesional con timestamps coloreados | Presentar, imprimir, archivar |

Los archivos se guardan en:
```
exports/txt/
exports/md/
exports/pdf/
```

---

## 5. Solución de problemas

**Error: "No se pudo descargar el audio"**
→ Verifica que yt-dlp esté instalado: `which yt-dlp`
→ Verifica la conexión a internet
→ El video puede estar restringido por región o ser privado

**Error: "Transcripción falló"**
→ Verifica que las dependencias Python estén instaladas: `pip install -r requirements.txt`
→ Verifica que el modelo Whisper esté descargado (la primera ejecución descarga ~300MB)

**La transcripción es muy lenta**
→ Usa un modelo más pequeño: edita `.env.local` y cambia `WHISPER_MODEL=base` a `tiny`
→ Verifica que no haya otros procesos consumiendo CPU

**Error de conexión en el puerto 5000**
→ Otro proceso puede estar usando el puerto: `fuser -k 5000/tcp`

---

## 6. Personalización

Edita el archivo `.env.local` en la raíz del proyecto:

```bash
# Modelo: tiny (rápido), base (balance), small (preciso)
WHISPER_MODEL=base

# Idioma: es, en, pt, fr, auto
WHISPER_LANGUAGE=es

# Desactivar corrección gramatical (si no hay internet)
LANGUAGETOOL_ENABLED=false
```

Después de cambiar, reinicia la aplicación.

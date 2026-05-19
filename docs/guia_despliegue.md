# Guía de Despliegue — my-vid-transcriber

Instalación en servidores, contenedores Docker, actualizaciones y CI/CD.

---

## 1. Requisitos del sistema

### Mínimos
- **CPU:** 2 núcleos (x86_64)
- **RAM:** 2 GB
- **Disco:** 1 GB libres (modelos Whisper: ~300MB para `base`)
- **SO:** Linux (kernel 5.6+), macOS, Windows (con WSL2)

### Recomendados
- **CPU:** 4+ núcleos (para chunking paralelo futuro con Go)
- **RAM:** 4 GB
- **GPU:** NVIDIA con driver 525+ y CUDA 12+ (para aceleración)
- **Disco SSD:** 5 GB libres

### Dependencias del sistema
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y ffmpeg yt-dlp python3 python3-pip curl

# Arch Linux
sudo pacman -S ffmpeg yt-dlp python python-pip

# macOS (Homebrew)
brew install ffmpeg yt-dlp python
```

---

## 2. Instalación desde cero

```bash
# 1. Clonar
git clone git@github.com:iagf-grupo10000/my-vid-transcriber.git
cd my-vid-transcriber

# 2. Instalar Bun (si no está)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. Dependencias Node.js
bun install

# 4. Dependencias Python
pip install -r requirements.txt

# 5. Configuración
cp .env.example .env.local
# Editar WHISPER_MODEL, WHISPER_LANGUAGE según necesidad

# 6. Build de producción
bun run build

# 7. Iniciar
bun run start    # http://localhost:5000
```

---

## 3. Despliegue con Docker

### Dockerfile
```dockerfile
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y ffmpeg yt-dlp python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock ./
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
RUN bun install

FROM base AS python-deps
COPY requirements.txt ./
RUN pip install -r requirements.txt --no-cache-dir

FROM base
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=python-deps /usr/local/lib/python3.*/dist-packages /usr/local/lib/python3.*/dist-packages
COPY . .
RUN bun run build
EXPOSE 5000
CMD ["bun", "run", "start"]
```

### Build y ejecución
```bash
docker build -t my-vid-transcriber .
docker run -d -p 5000:5000 \
  -e WHISPER_MODEL=base \
  -e WHISPER_LANGUAGE=es \
  -v whisper-cache:/root/.cache \
  my-vid-transcriber
```

---

## 4. Despliegue con systemd (Linux)

Crear archivo `/etc/systemd/system/my-vid-transcriber.service`:

```ini
[Unit]
Description=my-vid-transcriber
After=network.target

[Service]
Type=simple
User=alexander
WorkingDirectory=/home/alexander/Documentos/mcp/yt-transcriber
Environment=WHISPER_MODEL=base
Environment=WHISPER_LANGUAGE=es
Environment=LANGUAGETOOL_ENABLED=true
ExecStart=/home/alexander/.bun/bin/bun run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable my-vid-transcriber
sudo systemctl start my-vid-transcriber
sudo systemctl status my-vid-transcriber
```

### Logs
```bash
journalctl -u my-vid-transcriber -f
```

---

## 5. Actualización

```bash
cd ~/Documentos/mcp/yt-transcriber
git pull origin main
bun install
pip install -r requirements.txt --upgrade
bun run build
# Si usas systemd:
sudo systemctl restart my-vid-transcriber
```

---

## 6. Respaldos

### Qué respaldar
```bash
# Archivos de configuración
.env.local

# Exportaciones (si quieres conservarlas)
exports/

# Scripts personalizados (si los hay)
scripts/
```

### Qué NO respaldar (se regeneran)
```bash
node_modules/      # bun install
.next/             # bun run build
tmp/               # archivos temporales
bun.lock           # se regenera
~/.cache/huggingface/  # modelos, se descargan solos
```

---

## 7. Monitoreo

### Health check
```bash
curl http://localhost:5000
# Debe responder HTTP 200
```

### Prueba de API
```bash
# Probar transcripción con archivo pequeño
curl -s -X POST http://localhost:5000/api/transcribe/file \
  -F "file=@test.wav" | python3 -m json.tool
```

### Uso de recursos
```bash
# Ver consumo de la app
ps aux | grep next-server
# CPU/RAM en tiempo real
htop
```

---

## 8. Resolución de problemas comunes

### Error: "address already in use"
```bash
fuser -k 5000/tcp
```

### Error: "No module named faster_whisper"
```bash
pip install -r requirements.txt
```

### Error: "CUDA out of memory"
→ Cambiar a CPU: `WHISPER_DEVICE=cpu` en `.env.local`

### Error: "Modelo no encontrado"
→ Eliminar caché y reiniciar:
```bash
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-*
# La primera transcripción lo descargará automáticamente (~300MB)
```

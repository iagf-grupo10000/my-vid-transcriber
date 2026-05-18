#!/usr/bin/env bash
# ============================================================
#  Script de Deploy - YT Transcriber
#  Selecciona la plataforma de despliegue interactivamente
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║    YT TRANSCRIBER - SELECTOR DE DEPLOY   ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  1) Render.com  (recomendado - tiene FFmpeg incluido)"
echo "  2) Vercel      (serverless - requiere config extra de FFmpeg)"
echo "  3) Salir"
echo ""

read -rp "  Selecciona opción [1-3]: " choice

case "$choice" in
  1)
    echo ""
    echo "═══ Render.com ═══"
    echo ""
    echo "Pasos para desplegar en Render:"
    echo ""
    echo "  1. Crea una cuenta en https://dashboard.render.com"
    echo "  2. Conecta tu repositorio de GitHub"
    echo "  3. Crea un nuevo 'Web Service'"
    echo "  4. Conecta tu repo:"
    echo "       https://github.com/TU_USUARIO/yt-transcriber"
    echo "  5. Render detectará automáticamente render.yaml"
    echo "     O configura manualmente:"
    echo "       - Build Command:  npm install && npm run build"
    echo "       - Start Command:  npm start"
    echo "  6. Agrega variable de entorno:"
    echo "       HUGGINGFACE_TOKEN = tu_token_de_huggingface"
    echo "  7. Haz clic en 'Create Web Service'"
    echo ""
    echo "  ✅ Render incluye FFmpeg por defecto."
    echo "  ⚡ Tu app estará lista en ~3 minutos."
    echo ""
    echo "  URL: https://yt-transcriber.onrender.com"
    echo ""

    # Opción: abrir directamente usando render CLI si está instalado
    if command -v render &>/dev/null; then
      read -rp "  ¿Iniciar deploy con Render CLI? (s/N): " yn
      if [[ "$yn" == "s" || "$yn" == "S" ]]; then
        render deploy
      fi
    fi
    ;;

  2)
    echo ""
    echo "═══ Vercel ═══"
    echo ""
    echo "Pasos para desplegar en Vercel:"
    echo ""
    echo "  1. Instala Vercel CLI (si no lo tienes):"
    echo "       npm i -g vercel"
    echo ""
    echo "  2. Desde este directorio, ejecuta:"
    echo "       vercel"
    echo ""
    echo "  3. Sigue las instrucciones interactivas:"
    echo "       - Loguea con tu cuenta de Vercel"
    echo "       - Vincular al proyecto"
    echo "       - Agregar variable de entorno:"
    echo "           HUGGINGFACE_TOKEN"
    echo ""
    echo "  4. Para desplegar a producción:"
    echo "       vercel --prod"
    echo ""
    echo "  ⚠️  NOTA: Vercel NO incluye FFmpeg en serverless."
    echo "  ⚠️  Videos largos pueden fallar por timeout (10s límite"
    echo "      en plan Hobby)."
    echo "  💡  Para FFmpeg en Vercel, se necesita usar"
    echo "      @ffmpeg-installer/ffmpeg (incluido en package.json"
    echo "      pero comentado en la API Route)."
    echo ""

    if command -v vercel &>/dev/null; then
      read -rp "  ¿Iniciar deploy con Vercel CLI ahora? (s/N): " yn
      if [[ "$yn" == "s" || "$yn" == "S" ]]; then
        vercel
      fi
    else
      echo "  Vercel CLI no está instalado."
      read -rp "  ¿Instalar Vercel CLI e iniciar deploy? (s/N): " yn
      if [[ "$yn" == "s" || "$yn" == "S" ]]; then
        npm i -g vercel
        vercel
      fi
    fi
    ;;

  3)
    echo ""
    echo "Saliendo..."
    exit 0
    ;;

  *)
    echo "Opción inválida. Saliendo."
    exit 1
    ;;
esac

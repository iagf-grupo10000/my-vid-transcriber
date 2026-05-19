#!/usr/bin/env python3
"""
Bridge de transcripción local usando faster-whisper.
Sustituye la dependencia de Hugging Face Router API.

Uso:
  python3 scripts/transcribe_local.py <audio_path> [--model base|small|medium] [--language es|en|auto] [--device cpu|cuda]

Salida (stdout):
  JSON con segmentos, texto completo, idioma detectado y metadata.

Requiere: pip install faster-whisper soundfile
"""

import argparse
import json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore", message="A NumPy version")

# ─── Cuánto tiempo se conserva el modelo en memoria ──────────────────────
# Se carga una vez y se reusa entre llamadas sucesivas dentro del mismo proceso.
_MODEL_CACHE: dict = {}
_LAST_USED: float = 0
_MODEL_TTL = 300  # segundos antes de descartar (5 min de inactividad)


def _get_model(model_name: str, device: str):
    """Carga (o reusa) un modelo faster-whisper."""
    global _MODEL_CACHE, _LAST_USED
    key = f"{model_name}@{device}"

    now = time.time()
    # Limpiar modelos viejos
    for k in list(_MODEL_CACHE.keys()):
        if k != key and now - _LAST_USED > _MODEL_TTL:
            del _MODEL_CACHE[k]

    if key not in _MODEL_CACHE:
        from faster_whisper import WhisperModel

        compute_type = "int8" if device == "cpu" else "float16"
        print(
            json.dumps({"event": "loading_model", "model": model_name, "device": device, "compute": compute_type}),
            file=sys.stderr,
        )
        _MODEL_CACHE[key] = WhisperModel(model_name, device=device, compute_type=compute_type)
        print(json.dumps({"event": "model_loaded", "model": model_name}), file=sys.stderr)

    _LAST_USED = now
    return _MODEL_CACHE[key]


def transcribe(
    audio_path: str,
    model_name: str = "base",
    language: str | None = "es",
    device: str = "cpu",
    beam_size: int = 5,
):
    """
    Transcribe un archivo de audio usando faster-whisper.

    Args:
        audio_path: Ruta al archivo WAV/PCM (16kHz mono recomendado)
        model_name: Modelo Whisper (tiny, base, small, medium, large-v3)
        language: Código ISO ('es', 'en') o None para detección automática
        device: 'cpu' o 'cuda'
        beam_size: Tamaño del beam search (1-5, mayor = más preciso pero más lento)

    Returns:
        dict con transcripción completa
    """
    if not os.path.isfile(audio_path):
        return {"error": f"Archivo no encontrado: {audio_path}"}

    file_size = os.path.getsize(audio_path)
    print(json.dumps({"event": "transcribe_start", "file": audio_path, "size_bytes": file_size}), file=sys.stderr)

    model = _get_model(model_name, device)
    t_start = time.time()

    kwargs = {"beam_size": beam_size}
    if language:
        kwargs["language"] = language

    segments_gen, info = model.transcribe(audio_path, **kwargs)

    segments = []
    full_text_parts = []
    for seg in segments_gen:
        seg_dict = {
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        }
        segments.append(seg_dict)
        full_text_parts.append(seg.text.strip())

    elapsed = time.time() - t_start

    result = {
        "success": True,
        "model": model_name,
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration_seconds": round(info.duration, 2) if info.duration else None,
        "processing_seconds": round(elapsed, 2),
        "num_segments": len(segments),
        "segments": segments,
        "text": " ".join(full_text_parts),
        "text_with_timestamps": "\n".join(
            f"[{_fmt_time(s['start'])}] {s['text']}" for s in segments
        ),
    }

    print(json.dumps({"event": "transcribe_done", "elapsed": elapsed}), file=sys.stderr)
    return result


def _fmt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def main():
    parser = argparse.ArgumentParser(description="Transcripción local con faster-whisper")
    parser.add_argument("audio_path", help="Ruta al archivo de audio (WAV 16kHz mono recomendado)")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"),
                        help="Modelo Whisper (tiny/base/small/medium/large-v3)")
    parser.add_argument("--language", default=os.environ.get("WHISPER_LANGUAGE", "es"),
                        help="Código ISO del idioma (es/en/pt/fr) o 'auto'")
    parser.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "cpu"),
                        help="Dispositivo: cpu o cuda")
    parser.add_argument("--beam-size", type=int, default=5,
                        help="Beam search size (1-5). ENV: WHISPER_BEAM_SIZE")

    args = parser.parse_args()
    lang = None if args.language == "auto" else args.language

    result = transcribe(
        audio_path=args.audio_path,
        model_name=args.model,
        language=lang,
        device=args.device,
        beam_size=args.beam_size,
    )

    # Siempre retornar JSON por stdout
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

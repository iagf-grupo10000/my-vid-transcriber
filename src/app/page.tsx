'use client';
import { useState, useRef } from 'react';
import axios from 'axios';

interface ResultData {
  text: string;
  textWithTimestamps?: string;
  title: string;
  duration?: string;
  chunks?: number;
  sourceType: 'youtube' | 'local';
  sourceUrl?: string;
}

type TabType = 'youtube' | 'file';

export default function Home() {
  const [tab, setTab] = useState<TabType>('youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranscribe = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setExportMsg('');
    try {
      let res;
      if (tab === 'youtube') {
        res = await axios.post('/api/transcribe', { url });
      } else {
        if (!file) throw new Error('Selecciona un archivo');
        const fd = new FormData();
        fd.append('file', file);
        res = await axios.post('/api/transcribe/file', fd);
      }
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al procesar');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (fmt: string) => {
    if (!result) return;
    setExporting(fmt);
    setExportMsg('');
    try {
      const res = await axios.post('/api/export', {
        text: result.text,
        textWithTimestamps: result.textWithTimestamps,
        title: result.title,
        duration: result.duration,
        chunks: result.chunks,
        sourceUrl: result.sourceUrl,
        formats: [fmt],
      });

      const file = res.data.files?.[0];
      if (file?.url) {
        // Descargar
        const a = document.createElement('a');
        a.href = file.url;
        a.download = `${res.data.baseName}.${fmt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setExportMsg(`✅ ${fmt.toUpperCase()} descargado`);
      }
    } catch (err: any) {
      setExportMsg(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getYoutubeId = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.searchParams.get('v');
    } catch { return null; }
  };

  const videoId = getYoutubeId(url);

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-2 text-center">
        my-vid-transcriber
        <span className="block text-sm font-normal text-gray-500 mt-1">
          Whisper IA + LanguageTool · Sin costos
        </span>
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-2">
        <button
          onClick={() => setTab('youtube')}
          className={`px-4 py-2 rounded-t text-sm font-medium cursor-pointer transition-colors ${
            tab === 'youtube'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          YouTube URL
        </button>
        <button
          onClick={() => setTab('file')}
          className={`px-4 py-2 rounded-t text-sm font-medium cursor-pointer transition-colors ${
            tab === 'file'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Archivo local
        </button>
      </div>

      {/* YouTube input */}
      {tab === 'youtube' && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Pega la URL de YouTube aquí..."
            className="flex-1 p-3 border rounded shadow-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            onClick={handleTranscribe}
            disabled={loading || !url}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer font-medium"
          >
            {loading ? '...' : 'Transcribir'}
          </button>
        </div>
      )}

      {/* File upload */}
      {tab === 'file' && (
        <div className="mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type || 'desconocido'}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-lg mb-1">📂 Suelta un archivo aquí o haz clic</p>
                <p className="text-sm text-gray-400">MP3, WAV, M4A, MP4, MPEG, AVI, MOV, MKV</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.flac,.ogg,.mp4,.mpeg,.avi,.mov,.mkv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={handleTranscribe}
            disabled={loading || !file}
            className="mt-3 w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer font-medium"
          >
            {loading ? 'Transcribiendo...' : 'Transcribir archivo'}
          </button>
        </div>
      )}

      {/* Reproductor YouTube */}
      {tab === 'youtube' && videoId && !loading && (
        <div className="mb-6 aspect-video w-full bg-black rounded overflow-hidden">
          <iframe width="100%" height="100%"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded mb-4 border border-red-200">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-6 bg-blue-50 rounded border text-center text-blue-700">
          <div className="animate-pulse">
            <p className="font-medium">⏳ Procesando...</p>
            <p className="text-sm mt-1">
              {tab === 'youtube' ? 'Descargando → dividiendo → transcribiendo' : 'Convirtiendo → dividiendo → transcribiendo'}
            </p>
            <p className="text-xs mt-2 text-blue-500">Videos largos pueden tomar varios minutos</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span>📄 {result.title}</span>
            {result.duration && <span>⏱️ {result.duration}</span>}
            {result.chunks && <span>📦 {result.chunks} fragmentos</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              result.sourceType === 'youtube' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
            }`}>
              {result.sourceType === 'youtube' ? 'YouTube' : 'Archivo local'}
            </span>
          </div>

          {/* Vistas: texto plano / timestamps */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowTimestamps(false)}
              className={`px-4 py-1.5 rounded text-sm font-medium cursor-pointer ${
                !showTimestamps ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>Texto plano</button>
            <button onClick={() => setShowTimestamps(true)}
              className={`px-4 py-1.5 rounded text-sm font-medium cursor-pointer ${
                showTimestamps ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>Con timestamps</button>

            {/* Botones exportar */}
            <div className="ml-auto flex gap-2">
              {['txt', 'md', 'pdf'].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)}
                  disabled={exporting === fmt}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                    fmt === 'txt' ? 'bg-gray-600 text-white hover:bg-gray-700' :
                    fmt === 'md' ? 'bg-blue-700 text-white hover:bg-blue-800' :
                    'bg-red-600 text-white hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {exporting === fmt ? '...' : fmt}
                </button>
              ))}
            </div>
          </div>

          {exportMsg && (
            <div className="text-sm text-green-700 bg-green-50 p-2 rounded">{exportMsg}</div>
          )}

          {/* Transcripción */}
          <div className="bg-gray-50 p-6 rounded border shadow-inner">
            <h2 className="text-xl font-semibold mb-2">
              {showTimestamps ? 'Transcripción con timestamps:' : 'Transcripción:'}
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800 text-sm">
              {showTimestamps && result.textWithTimestamps
                ? result.textWithTimestamps
                : result.text}
            </p>
          </div>
        </div>
      )}

      {/* Footer con deploy */}
      <div className="mt-10 space-y-3 text-xs text-gray-500 text-center">
        <p>Whisper large-v3-turbo (Hugging Face) · LanguageTool · Next.js 16</p>
        <div className="pt-2 border-t border-gray-200">
          <p className="text-gray-400 mb-2 font-medium">Despliegue:</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => {
              const el = document.getElementById('deploy-details');
              if (el) el.innerHTML = `<div class="bg-green-50 border border-green-200 rounded p-4 text-left mt-3 text-green-800"><p class="font-semibold mb-2">Render.com (recomendado)</p><ol class="list-decimal list-inside space-y-1"><li>Crea cuenta en dashboard.render.com</li><li>Conecta tu repositorio de GitHub</li><li>Render detecta render.yaml automáticamente</li><li>Agrega variable: HUGGINGFACE_TOKEN</li></ol><p class="mt-2 font-medium">✅ FFmpeg incluido</p></div>`;
            }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 cursor-pointer">Render</button>
            <button onClick={() => {
              const el = document.getElementById('deploy-details');
              if (el) el.innerHTML = `<div class="bg-gray-50 border border-gray-200 rounded p-4 text-left mt-3 text-gray-800"><p class="font-semibold mb-2">Vercel</p><ol class="list-decimal list-inside space-y-1"><li>npm i -g vercel</li><li>Ejecuta: vercel</li><li>Agrega variable: HUGGINGFACE_TOKEN</li></ol><p class="mt-2 text-amber-700">⚠️ Sin FFmpeg nativo · Timeout 10s</p></div>`;
            }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-medium rounded hover:bg-gray-800 cursor-pointer border border-gray-700">Vercel</button>
          </div>
          <div id="deploy-details" className="mt-2"></div>
        </div>
      </div>
    </main>
  );
}

'use client';
import { useState } from 'react';
import axios from 'axios';

interface ResultData {
  text: string;
  textWithTimestamps?: string;
  duration?: string;
  chunks?: number;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);

  const handleTranscribe = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.post('/api/transcribe', { url });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo transcribir. Verifica la URL o intenta más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const getYoutubeId = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.searchParams.get('v');
    } catch {
      return null;
    }
  };

  const videoId = getYoutubeId(url);

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-2 text-center">
        Transcriptor YouTube
        <span className="block text-sm font-normal text-gray-500 mt-1">
          Whisper IA + LanguageTool · Sin costos
        </span>
      </h1>

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
          {loading ? 'Transcribiendo...' : 'Transcribir'}
        </button>
      </div>

      {videoId && !loading && (
        <div className="mb-6 aspect-video w-full bg-black rounded overflow-hidden">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded mb-4 border border-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-6 bg-blue-50 rounded border text-center text-blue-700">
          <div className="animate-pulse">
            <p className="font-medium">⏳ Procesando audio...</p>
            <p className="text-sm mt-1">
              Descargando → dividiendo en segmentos → transcribiendo cada uno
            </p>
            <p className="text-xs mt-2 text-blue-500">
              Para videos largos (+1h) el proceso puede tomar varios minutos
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.duration && (
            <div className="text-sm text-gray-500 flex gap-4">
              <span>⏱️ Duración: {result.duration}</span>
              {result.chunks && <span>📦 Fragmentos: {result.chunks}</span>}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowTimestamps(false)}
              className={`px-4 py-1.5 rounded text-sm font-medium cursor-pointer ${
                !showTimestamps
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Texto plano
            </button>
            <button
              onClick={() => setShowTimestamps(true)}
              className={`px-4 py-1.5 rounded text-sm font-medium cursor-pointer ${
                showTimestamps
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Con timestamps
            </button>
          </div>

          <div className="bg-gray-50 p-6 rounded border shadow-inner">
            <h2 className="text-xl font-semibold mb-2">
              {showTimestamps ? 'Transcripción con timestamps:' : 'Transcripción:'}
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
              {showTimestamps && result.textWithTimestamps
                ? result.textWithTimestamps
                : result.text}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3 text-xs text-gray-500 text-center">
        <p>Whisper Tiny (Hugging Face) · LanguageTool · Next.js 16</p>

        {/* Selector de plataforma de deploy */}
        <div className="pt-2 border-t border-gray-200">
          <p className="text-gray-400 mb-2 font-medium">Selecciona plataforma de despliegue:</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                const details = document.getElementById('deploy-details');
                if (details) {
                  details.innerHTML = `
                    <div class="bg-green-50 border border-green-200 rounded p-4 text-left mt-3">
                      <p class="font-semibold text-green-800 mb-2">Render.com (recomendado)</p>
                      <ol class="list-decimal list-inside space-y-1 text-green-700">
                        <li>Crea cuenta en https://dashboard.render.com</li>
                        <li>Conecta tu repositorio de GitHub</li>
                        <li>Crea Web Service → selecciona tu repo</li>
                        <li>Render detecta render.yaml automáticamente</li>
                        <li>Agrega variable: HUGGINGFACE_TOKEN</li>
                        <li>Create Web Service → listo en ~3 min</li>
                      </ol>
                      <p class="mt-2 text-green-700 font-medium">✅ FFmpeg incluido por defecto</p>
                      <p class="mt-1 text-green-600">Comando: ./deploy.sh (opción 1)</p>
                    </div>
                  `;
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Render
            </button>

            <button
              onClick={() => {
                const details = document.getElementById('deploy-details');
                if (details) {
                  details.innerHTML = `
                    <div class="bg-gray-50 border border-gray-200 rounded p-4 text-left mt-3">
                      <p class="font-semibold text-gray-800 mb-2">Vercel</p>
                      <ol class="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Instala CLI: npm i -g vercel</li>
                        <li>Ejecuta: vercel (desde este directorio)</li>
                        <li>Sigue las instrucciones interactivas</li>
                        <li>Agrega variable: HUGGINGFACE_TOKEN</li>
                        <li>Producción: vercel --prod</li>
                      </ol>
                      <p class="mt-2 text-amber-700 font-medium">⚠️ Sin FFmpeg nativo en serverless</p>
                      <p class="mt-1 text-amber-600">Límite 10s timeout (plan Hobby)</p>
                      <p class="mt-1 text-gray-600">Comando: ./deploy.sh (opción 2)</p>
                    </div>
                  `;
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors border border-gray-700 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 22.525H0l12-21.05 12 21.05z"/></svg>
              Vercel
            </button>
          </div>

          <div id="deploy-details" className="mt-2"></div>

          <p className="text-gray-400 mt-2">
            o ejecuta <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">./deploy.sh</code> desde la terminal
          </p>
        </div>
      </div>
    </main>
  );
}

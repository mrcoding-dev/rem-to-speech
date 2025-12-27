import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import { useState, useEffect } from 'react';

function StopButton() {
  const plugin = usePlugin();
  const [isSpeaking, setIsSpeaking] = useState(true);

  useEffect(() => {
    const checkStatus = setInterval(() => {
      const globalState = (window as any).speechState;
      if (globalState) {
        setIsSpeaking(globalState.isPlaying);
      } else {
        setIsSpeaking(window.speechSynthesis.speaking);
      }
    }, 100);

    return () => clearInterval(checkStatus);
  }, []);

  const handleStop = () => {
    // Llamar a la función global de stop
    if ((window as any).stopSpeech) {
      (window as any).stopSpeech();
    } else {
      window.speechSynthesis.cancel();
    }

    plugin.window.closeFloatingWidget('stop-button');
  };

  const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  const labels = {
    es: {
      stop: 'Detener',
      reading: 'Leyendo...'
    },
    en: {
      stop: 'Stop',
      reading: 'Reading...'
    }
  }[lang];

  return (
    <div style={{
      padding: '12px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '200px'
    }}>
      <div style={{
        color: 'white',
        fontSize: '12px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#4ade80',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}></span>
        {labels.reading}
      </div>

      <button
        style={{
          padding: '10px 20px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        onClick={handleStop}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }}
      >
        {'⏹ ' + labels.stop}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

renderWidget(StopButton); 
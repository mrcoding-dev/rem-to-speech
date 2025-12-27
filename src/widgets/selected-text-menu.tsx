import { renderWidget, usePlugin, useTracker } from '@remnote/plugin-sdk';
import { useState, useEffect } from 'react';

function SelectedTextMenuWidget() {
  const plugin = usePlugin();
  const [isReading, setIsReading] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  const labels = {
    es: {
      readText: 'Leer Texto',
      reading: 'Leyendo...',
      noText: 'No hay texto para leer',
    },
    en: {
      readText: 'Read Text',
      reading: 'Reading...',
      noText: 'No text to read',
    }
  }[lang];

  // Función para extraer texto de RichText
  const extractText = (richText: any): string => {
    if (!richText) return '';
    if (typeof richText === 'string') return richText;

    if (Array.isArray(richText)) {
      return richText.map((part: any) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if ('text' in part) return part.text;
          if ('children' in part && Array.isArray(part.children)) {
            return extractText(part.children);
          }
        }
        return '';
      }).join('').trim();
    }

    return '';
  };

  // Usar useTracker para monitorear cambios en la selección
  const selection = useTracker(async (reactivePlugin) => {
    return await reactivePlugin.editor.getSelection();
  });

  // Actualizar el texto seleccionado cuando cambia la selección
  useEffect(() => {
    const updateSelectedText = async () => {
      if (selection && 'type' in selection) {
        if (selection.type === 'Rem') {
          // Selección de Rems
          const selectedRems = await Promise.all(
            selection.remIds.map(id => plugin.rem.findOne(id))
          );

          const texts = selectedRems
            .filter((rem): rem is NonNullable<typeof rem> => rem !== null && rem !== undefined)
            .map(rem => {
              if (rem.text) {
                return extractText(rem.text);
              }
              return '';
            })
            .filter(text => text.length > 0);

          setSelectedText(texts.join('. '));
        } else if (selection.type === 'Text' && 'richText' in selection) {
          // Selección de texto dentro de un Rem
          const text = extractText(selection.richText);
          setSelectedText(text);
        }
      } else {
        setSelectedText('');
      }
    };

    updateSelectedText();
  }, [selection]);

  const handleReadSelection = async () => {
    if (!selectedText || selectedText.trim().length === 0) {
      plugin.app.toast(labels.noText);
      return;
    }

    setIsReading(true);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(selectedText);

    const selectedVoiceName = await plugin.settings.getSetting("voice-selection");
    if (selectedVoiceName) {
      const selectedVoice = speechSynthesis.getVoices().find(voice => voice.name === selectedVoiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else {
      utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
    }

    const speed = parseFloat(await plugin.settings.getSetting('voice-speed')) || 1;
    const volume = parseFloat(await plugin.settings.getSetting('voice-volume')) || 1;

    utterance.rate = Math.max(0.5, Math.min(2, speed));
    utterance.volume = Math.max(0, Math.min(1, volume));
    utterance.pitch = 1;

    utterance.onend = () => {
      setIsReading(false);
    };

    utterance.onerror = () => {
      setIsReading(false);
    };

    window.speechSynthesis.speak(utterance);

    // Abrir widget de controles
    try {
      await plugin.window.openFloatingWidget('stop-button', {
        bottom: 20,
        right: 20
      });
    } catch (e) {
      // Widget ya abierto
    }
  };

  return (
    <button
      onClick={handleReadSelection}
      disabled={isReading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: isReading ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isReading ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s',
        width: '100%',
        justifyContent: 'center',
        opacity: isReading ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isReading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
      {isReading ? labels.reading : labels.readText}
    </button>
  );
}

renderWidget(SelectedTextMenuWidget);

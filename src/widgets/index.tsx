import { declareIndexPlugin, ReactRNPlugin, RichTextInterface, EditorEvents, WidgetLocation } from "@remnote/plugin-sdk";

// Textos traducibles
const i18n = {
  es: {
    noText: "No hay texto para leer!",
    noSelection: "No hay texto seleccionado",
    readSelected: "Leer Texto Seleccionado",
    readSelectedDesc: "Lee el texto seleccionado usando síntesis de voz",
    voiceSpeed: "Velocidad de la Voz",
    voiceVolume: "Volumen de la Voz",
    voiceSpeedDesc: "Ajusta la velocidad de lectura (0.5 a 2)",
    voiceVolumeDesc: "Ajusta el volumen de la voz (0 a 1)",
    voiceSelection: "Selección de Voz",
    voiceSelectionDesc: "Selecciona la voz a usar para Text to Speech"
  },
  en: {
    noText: "No text to read!",
    noSelection: "No text selected",
    readSelected: "Read Selected Text",
    readSelectedDesc: "Read selected text using speech synthesis",
    voiceSpeed: "Voice Speed",
    voiceVolume: "Voice Volume",
    voiceSpeedDesc: "Adjust reading speed (0.5 to 2)",
    voiceVolumeDesc: "Adjust voice volume (0 to 1)",
    voiceSelection: "Voice Selection",
    voiceSelectionDesc: "Select the voice to use for Text to Speech"
  }
};

async function onActivate(plugin: ReactRNPlugin) {
  const lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  const t = i18n[lang];

  // Función para obtener la calidad de una voz basada en su nombre
  function getVoiceQuality(voice: SpeechSynthesisVoice): number {
    const name = voice.name.toLowerCase();
    // Voces de alta calidad
    if (name.includes('premium') || name.includes('neural') || name.includes('enhanced')) return 3;
    // Voces de Microsoft Edge/Google
    if (name.includes('microsoft') || name.includes('google')) return 2;
    // Voces naturales
    if (voice.localService) return 1;
    return 0;
  }

  // Función para actualizar las opciones de voz
  function updateVoiceOptions() {
    const voices = speechSynthesis.getVoices();

    // Organizar voces por idioma y calidad
    const sortedVoices = voices.sort((a, b) => {
      // Primero por calidad
      const qualityDiff = getVoiceQuality(b) - getVoiceQuality(a);
      if (qualityDiff !== 0) return qualityDiff;

      // Luego por idioma (priorizar idioma del usuario)
      const userLang = navigator.language.toLowerCase();
      const aMatchesLang = a.lang.toLowerCase().startsWith(userLang.split('-')[0]) ? 1 : 0;
      const bMatchesLang = b.lang.toLowerCase().startsWith(userLang.split('-')[0]) ? 1 : 0;
      if (bMatchesLang !== aMatchesLang) return bMatchesLang - aMatchesLang;

      // Finalmente alfabéticamente
      return a.name.localeCompare(b.name);
    });

    // Crear etiquetas mejoradas
    const voiceOptions = sortedVoices.map(voice => {
      const quality = getVoiceQuality(voice);
      let qualityBadge = '';
      if (quality === 3) qualityBadge = '⭐ ';
      else if (quality === 2) qualityBadge = '✓ ';

      return {
        key: voice.name,
        label: `${qualityBadge}${voice.name} (${voice.lang})`,
        value: voice.name,
      };
    });

    plugin.settings.registerDropdownSetting({
      id: "voice-selection",
      title: t.voiceSelection || "Voice Selection",
      description: t.voiceSelectionDesc || "Select the voice to use for Text to Speech",
      options: voiceOptions,
    });
  }

  // Inicializar opciones de voz
  updateVoiceOptions();
  speechSynthesis.onvoiceschanged = updateVoiceOptions;

  // Registrar el widget de detener
  await plugin.app.registerWidget('stop-button', WidgetLocation.FloatingWidget, {
    dimensions: { height: 70, width: 200 }
  });

  // Registrar el widget del menú de texto seleccionado
  await plugin.app.registerWidget('selected-text-menu', WidgetLocation.SelectedTextMenu, {
    dimensions: {
      height: 'auto',
      width: '100%'
    },
    widgetTabIcon: 'https://cdn-icons-png.flaticon.com/512/3024/3024593.png',
    widgetTabTitle: lang === 'es' ? 'Leer' : 'Read'
  });

  // Registrar configuraciones
  await plugin.settings.registerStringSetting({
    id: 'voice-speed',
    title: t.voiceSpeed,
    description: t.voiceSpeedDesc,
    defaultValue: '1',
  });

  await plugin.settings.registerStringSetting({
    id: 'voice-volume',
    title: t.voiceVolume,
    description: t.voiceVolumeDesc,
    defaultValue: '1',
  });

  // Variable para almacenar el ID del widget actual
  let currentWidgetId: string | null = null;

  // Sistema de estado global simple
  const speechState = {
    isPlaying: false,
  };

  // Hacer el estado accesible globalmente
  (window as any).speechState = speechState;

  // Función para detener
  (window as any).stopSpeech = () => {
    speechState.isPlaying = false;
    window.speechSynthesis.cancel();
  };

  const readText = async (text: string) => {
    if (!text?.trim()) {
      plugin.app.toast(t.noText);
      return;
    }

    // Detener cualquier reproducción previa
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Aplicar la voz seleccionada
    const selectedVoiceName = await plugin.settings.getSetting("voice-selection");
    if (selectedVoiceName) {
      const selectedVoice = speechSynthesis.getVoices().find(voice => voice.name === selectedVoiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else {
      utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
    }

    utterance.pitch = 1;

    // Usar las configuraciones
    const speed = parseFloat(await plugin.settings.getSetting('voice-speed')) || 1;
    const volume = parseFloat(await plugin.settings.getSetting('voice-volume')) || 1;

    utterance.rate = Math.max(0.5, Math.min(2, speed));
    utterance.volume = Math.max(0, Math.min(1, volume));

    // Cerrar widget anterior si existe
    if (currentWidgetId) {
      try {
        await plugin.window.closeFloatingWidget(currentWidgetId);
      } catch (e) {
        // Widget ya cerrado
      }
    }

    // Actualizar estado
    speechState.isPlaying = true;

    // Mostrar botón de control
    currentWidgetId = await plugin.window.openFloatingWidget('stop-button', {
      bottom: 20,
      right: 20
    });

    utterance.onend = () => {
      speechState.isPlaying = false;
      if (currentWidgetId) {
        plugin.window.closeFloatingWidget(currentWidgetId);
        currentWidgetId = null;
      }
    };

    utterance.onerror = () => {
      speechState.isPlaying = false;
      if (currentWidgetId) {
        plugin.window.closeFloatingWidget(currentWidgetId);
        currentWidgetId = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const extractText = (richText: RichTextInterface): string => {
    if (!richText) return '';
    if (typeof richText === 'string') return richText;

    if (Array.isArray(richText)) {
      return richText.map(part => {
        // Si es texto plano
        if (typeof part === 'string') return part;

        if (part && typeof part === 'object') {
          const partObj = part as any;

          // Si es un objeto con texto directo
          if ('text' in partObj) return partObj.text;

          // Si es una referencia a un Rem
          if ('_type' in partObj && partObj._type === 'rem') {
            if ('text' in partObj) return partObj.text;
          }

          // Si es un elemento con formato (negrita, cursiva, etc.)
          if ('children' in partObj && Array.isArray(partObj.children)) {
            return extractText(partObj.children);
          }
        }

        return '';
      }).join('').trim();
    }

    return '';
  };

  // Comando para leer texto seleccionado
  plugin.app.registerCommand({
    id: 'read-selected-text',
    name: t.readSelected,
    description: t.readSelectedDesc,
    action: async () => {
      const selection = await plugin.editor.getSelection();
      if (selection && 'type' in selection && selection.type === 'Rem') {
        const selectedRems = await Promise.all(
          selection.remIds.map(id => plugin.rem.findOne(id))
        );

        const textsToRead = selectedRems
          .filter((rem): rem is NonNullable<typeof rem> => rem !== null && rem !== undefined)
          .filter((rem): rem is typeof rem & { text: RichTextInterface } => rem.text !== undefined)
          .map(rem => extractText(rem.text))
          .join('. ');

        if (textsToRead) {
          readText(textsToRead);
        } else {
          plugin.app.toast(t.noSelection);
        }
      } else {
        const focusedRem = await plugin.focus.getFocusedRem();
        if (focusedRem?.text) {
          readText(extractText(focusedRem.text));
        } else {
          plugin.app.toast(t.noSelection);
        }
      }
    },
  });

}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);

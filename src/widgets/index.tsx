import { declareIndexPlugin, ReactRNPlugin, RichTextInterface, EditorEvents, WidgetLocation } from "@remnote/plugin-sdk";

// Textos traducibles
const i18n = {
  es: {
    noText: "No hay texto para leer!",
    noSelection: "No hay texto seleccionado",
    noFocusedRem: "No hay ningún Rem enfocado!",
    readSelected: "Leer Texto Seleccionado",
    readSelectedDesc: "Lee el texto seleccionado usando síntesis de voz",
    readCurrent: "Leer Rem Actual",
    readCurrentDesc: "Lee el texto del Rem actualmente enfocado",
    voiceSettings: "Configuración de Voz",
    voiceSettingsDesc: "Configura la velocidad y el volumen de la voz",
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
    noFocusedRem: "No Rem focused!",
    readSelected: "Read Selected Text",
    readSelectedDesc: "Read selected text using speech synthesis",
    readCurrent: "Read Current Rem",
    readCurrentDesc: "Read the text of the currently focused Rem",
    voiceSettings: "Voice Settings",
    voiceSettingsDesc: "Configure voice speed and volume",
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

  // Función para actualizar las opciones de voz
  function updateVoiceOptions() {
    plugin.settings.registerDropdownSetting({
      id: "voice-selection",
      title: t.voiceSelection || "Voice Selection",
      description: t.voiceSelectionDesc || "Select the voice to use for Text to Speech",
      options: speechSynthesis.getVoices().map(voice => ({
        key: voice.name,
        label: `${voice.name} (${voice.lang})`,
        value: voice.name,
      })),
    });
  }

  // Inicializar opciones de voz
  updateVoiceOptions();
  speechSynthesis.onvoiceschanged = updateVoiceOptions;

  // Registrar el widget de detener
  await plugin.app.registerWidget('stop-button', WidgetLocation.FloatingWidget, {
    dimensions: { height: 50, width: 200 }
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

  const readText = async (text: string) => {
    if (!text?.trim()) {
      plugin.app.toast(t.noText);
      return;
    }

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
    
    utterance.rate = Math.max(0.5, Math.min(2, speed));  // limitar entre 0.5 y 2
    utterance.volume = Math.max(0, Math.min(1, volume)); // limitar entre 0 y 1

    // Mostrar botón de detener
    const widgetId = await plugin.window.openFloatingWidget('stop-button', {
      bottom: 20,
      right: 20
    });

    utterance.onend = () => {
      plugin.window.closeFloatingWidget(widgetId);
    };

    window.speechSynthesis.speak(utterance);
  };

  const extractText = (richText: RichTextInterface): string => {
    return richText.map(part => {
      // Si es texto plano
      if (typeof part === 'string') return part;
      
      // Si es un objeto con texto
      if ('text' in part) return part.text;
      
      // Si es una referencia a un Rem
      if ('_type' in part && part._type === 'rem') {
        // Intentar obtener el texto del Rem referenciado
        if ('text' in part) return part.text;
      }

      // Si es un elemento con formato (negrita, cursiva, etc.)
      if ('children' in part && Array.isArray(part.children)) {
        return extractText(part.children);
      }

      return '';
    }).join(' ').trim();
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

  // Comando para leer Rem actual
  plugin.app.registerCommand({
    id: 'read-current-rem',
    name: t.readCurrent,
    description: t.readCurrentDesc,
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      if (focusedRem?.text) {
        readText(extractText(focusedRem.text));
      } else {
        plugin.app.toast(t.noFocusedRem);
      }
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);

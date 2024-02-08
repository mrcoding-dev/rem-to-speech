import { declareIndexPlugin, ReactRNPlugin } from "@remnote/plugin-sdk";

async function onActivate(plugin: ReactRNPlugin) {
  // Registra la configuración para seleccionar la voz
  function updateVoiceOptions() {
    plugin.settings.registerDropdownSetting({
      id: "voice-selection",
      title: "Voice Selection",
      description: "Select the voice to use for Text to Speech",
      options: speechSynthesis.getVoices().map(voice => ({
        key: voice.name,
        label: `${voice.name} (${voice.lang})`,
        value: voice.name,
      })),
    });
  }

  // Llama a updateVoiceOptions inmediatamente y también cuando cambian las voces disponibles
  updateVoiceOptions();
  speechSynthesis.onvoiceschanged = updateVoiceOptions;

  // Registra el comando para leer el Rem enfocado
  plugin.app.registerCommand({
    id: 'read-current-rem',
    name: 'Read Current Rem',
    description: 'Reads the text of the currently focused Rem using Text to Speech',
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      if (focusedRem && focusedRem.text) {
        // Obtiene la voz seleccionada de la configuración
        const selectedVoiceName = await plugin.settings.getSetting("voice-selection");
        const remContent = focusedRem.text as any[]; // Asumiendo que no tenemos un tipo específico para RichTextElement
        const textToRead = remContent.map(part =>
          typeof part === 'string' ? part : part.text || ''
        ).join(' ');

        const utterance = new SpeechSynthesisUtterance(textToRead);
        // Encuentra y aplica la voz seleccionada
        const selectedVoice = speechSynthesis.getVoices().find(voice => voice.name === selectedVoiceName);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        speechSynthesis.speak(utterance);
      } else {
        plugin.app.toast("No Rem is currently focused or it has no text!");
      }
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);

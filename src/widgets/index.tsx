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
    readCurrentDesc: "Lee el texto del Rem actualmente enfocado"
  },
  en: {
    noText: "No text to read!",
    noSelection: "No text selected",
    noFocusedRem: "No Rem focused!",
    readSelected: "Read Selected Text",
    readSelectedDesc: "Read selected text using speech synthesis",
    readCurrent: "Read Current Rem",
    readCurrentDesc: "Read the text of the currently focused Rem"
  }
};

async function onActivate(plugin: ReactRNPlugin) {
  const lang = navigator.language.startsWith('es') ? 'es' : 'en';
  const t = i18n[lang];

  // Registrar el widget de detener
  await plugin.app.registerWidget('stop-button', WidgetLocation.FloatingWidget, {
    dimensions: { height: '50px', width: '200px' }
  });

  const readText = async (text: string) => {
    if (!text?.trim()) {
      plugin.app.toast(t.noText);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

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
      if (typeof part === 'string') return part;
      if ('_type' in part && part._type === 'rem') return '';
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

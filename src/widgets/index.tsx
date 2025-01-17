import { declareIndexPlugin, ReactRNPlugin, RichTextInterface, EditorEvents } from "@remnote/plugin-sdk";

async function onActivate(plugin: ReactRNPlugin) {
  // Función para leer texto
  const readText = (text: string) => {
    if (!text || !text.trim()) {
      plugin.app.toast("No hay texto para leer!");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Función para extraer texto plano de RichText
  const extractText = (richText: RichTextInterface): string => {
    return richText.map(part => {
      if (typeof part === 'string') return part;
      if ('_type' in part && part._type === 'rem') return '';
      return '';
    }).join(' ').trim();
  };

  // Variable para almacenar la última selección
  let lastSelection = '';

  // Función para extraer texto de TextSelection
  const extractSelectedText = (selection: any): string => {
    return selection?.toString() || '';
  };

  // Escuchar cambios en la selección
  plugin.event.addListener(EditorEvents.EditorSelectionChanged, undefined, async (data: any) => {
    try {
      if (data?.text) {
        lastSelection = data.text;
        console.log('Selected text:', lastSelection);
      }
    } catch (error) {
      console.error('Error getting selected text:', error);
    }
  });

  // Comando para leer texto seleccionado
  plugin.app.registerCommand({
    id: 'read-selected-text',
    name: 'Leer Texto Seleccionado',
    description: 'Lee el texto seleccionado usando síntesis de voz',
    action: async () => {
      try {
        const selection = await plugin.editor.getSelection();
        
        if (selection && 'type' in selection && selection.type === 'Rem') {
          // Es una selección de Rem
          const selectedRem = await plugin.rem.findOne(selection.remIds[0]);
          if (selectedRem?.text) {
            readText(extractText(selectedRem.text));
          }
        } else if (lastSelection.trim()) {
          readText(lastSelection);
        } else {
          // Si no hay texto seleccionado, intentamos leer el Rem enfocado
          const focusedRem = await plugin.focus.getFocusedRem();
          if (focusedRem?.text) {
            readText(extractText(focusedRem.text));
          } else {
            plugin.app.toast("No hay texto seleccionado");
          }
        }
      } catch (error) {
        plugin.app.toast(`Error: ${error}`);
      }
    },
  });

  // Comando para leer Rem actual
  plugin.app.registerCommand({
    id: 'read-current-rem',
    name: 'Leer Rem Actual',
    description: 'Lee el texto del Rem actualmente enfocado',
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      if (focusedRem && focusedRem.text) {
        readText(extractText(focusedRem.text));
      } else {
        plugin.app.toast("No hay ningún Rem enfocado!");
      }
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);

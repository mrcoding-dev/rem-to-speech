import { declareIndexPlugin, ReactRNPlugin } from "@remnote/plugin-sdk";

async function onActivate(plugin: ReactRNPlugin) {
  plugin.app.registerCommand({
    id: 'read-current-rem',
    name: 'Read Current Rem',
    description: 'Reads the text of the currently focused Rem using Text to Speech',
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();
      if (focusedRem && focusedRem.text) { // Asegurándonos de que focusedRem y su propiedad text existan
        // Accediendo a la propiedad text como un array de elementos genéricos (any)
        const remContent = focusedRem.text as any[]; // Usamos 'as any[]' para tratar remContent como un array genérico
        const textToRead = remContent.map(part => 
          typeof part === 'string' ? part : (part as any).text || '' // Tratamos cada parte como 'any' para acceder a .text
        ).join(' ');
        const utterance = new SpeechSynthesisUtterance(textToRead);
        speechSynthesis.speak(utterance);
      } else {
        plugin.app.toast("No Rem is currently focused or it has no text!");
      }
    },
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);

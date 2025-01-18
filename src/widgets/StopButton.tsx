import { renderWidget, usePlugin } from '@remnote/plugin-sdk';

function StopButton() {
  const plugin = usePlugin();
  
  return (
    <button 
      style={{
        padding: '10px 20px',
        background: '#ff4444',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
      }}
      onClick={() => {
        window.speechSynthesis.cancel();
        plugin.window.closeFloatingWidget('stop-button');
      }}
    >
      Detener Lectura
    </button>
  );
}

renderWidget(StopButton); 
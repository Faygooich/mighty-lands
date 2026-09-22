import { createRoot } from 'react-dom/client';
import '@fontsource/alegreya-sc/700.css';
import '@fontsource/alegreya-sc/900.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/400-italic.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/alegreya-sans/800.css';
import { App } from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

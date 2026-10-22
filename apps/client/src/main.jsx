import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n.js';
import { App } from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { PreferencesProvider } from './components/PreferencesProvider.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

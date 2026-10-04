// Starting point of the React app: mounts <App /> inside the page and sets up routing.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AppProvider, MOCK } from './lib.jsx';
import App from './App.jsx';
import './styles.css';
const Router = MOCK ? HashRouter : BrowserRouter;
createRoot(document.getElementById('root')).render(
  <Router>
    <AppProvider>
      <App />
    </AppProvider>
  </Router>
);

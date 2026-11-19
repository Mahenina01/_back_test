import React from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { IncubatorProvider } from './context/IncubatorContext';
import { LiveDataProvider } from './context/LiveDataContext';
import { MqttProvider } from './context/MqttContext';
import Alarmes from './pages/Alarmes';
import Commandes from './pages/Commandes';
import Dashboard from './pages/Dashboard';
import Historique from './pages/Historique';
import LedControl from './pages/LedControl';
import Login from './pages/Login';
import Parametres from './pages/parametres';
import Profils from './pages/Profils';
import Synoptique from './pages/Synoptique';

function App() {
  return (
    <MqttProvider>
      <BrowserRouter>
        <AuthProvider>
          <IncubatorProvider>
            <LiveDataProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="synoptique" element={<Synoptique />} />
                  <Route path="historique" element={<Historique />} />
                  <Route path="commandes" element={<Commandes />} />
                  <Route path="led" element={<LedControl />} />
                  <Route path="profils" element={<Profils />} />
                  <Route path="alarmes" element={<Alarmes />} />
                  <Route path="parametres" element={<Parametres />} />
                </Route>
              </Routes>
            </LiveDataProvider>
          </IncubatorProvider>
        </AuthProvider>
      </BrowserRouter>
    </MqttProvider>
  );
}

export default App;
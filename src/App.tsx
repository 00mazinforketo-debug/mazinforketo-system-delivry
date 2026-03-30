import { BrowserRouter } from 'react-router-dom';
import { AppBootstrap } from './app/bootstrap';
import { OfflineSyncBootstrap } from './app/offline-sync-bootstrap';
import { AppRouter } from './app/router';
import { ToastViewport } from './components/ui/ToastViewport';

const App = () => (
  <AppBootstrap>
    <BrowserRouter>
      <OfflineSyncBootstrap />
      <AppRouter />
      <ToastViewport />
    </BrowserRouter>
  </AppBootstrap>
);

export default App;

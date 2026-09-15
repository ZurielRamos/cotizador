import { Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import DispositivosPage from '@/pages/DispositivosPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PlantillasPage from '@/pages/PlantillasPage';
import ProgramacionDetallePage from '@/pages/ProgramacionDetallePage';
import ProgramacionesPage from '@/pages/ProgramacionesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="plantillas" element={<PlantillasPage />} />
        <Route path="programaciones" element={<ProgramacionesPage />} />
        <Route
          path="programaciones/:id"
          element={<ProgramacionDetallePage />}
        />
        <Route path="dispositivos" element={<DispositivosPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;

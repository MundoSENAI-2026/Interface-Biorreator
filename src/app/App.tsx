import { SimulationPanel } from './components/dashboard/SimulationPanel';
import { AlarmToasts } from './components/hmi/AlarmToasts';
import { BioreactorRoot } from './pages/BioreactorRoot';

export default function App() {
  return (
    <div className="min-h-screen bg-page text-ink">
      <BioreactorRoot />
      <AlarmToasts />
      <SimulationPanel />
    </div>
  );
}

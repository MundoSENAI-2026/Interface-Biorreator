import { Toaster } from 'sonner';
import { BioreactorRoot } from './pages/BioreactorRoot';

export default function App() {
  return (
    <div className="min-h-screen bg-page text-ink">
      <Toaster position="top-right" theme="light" />
      <BioreactorRoot />
    </div>
  );
}

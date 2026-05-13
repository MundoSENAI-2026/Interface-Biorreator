import { Toaster } from 'sonner';
import { BioreactorRoot } from './pages/BioreactorRoot';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0e14] dark">
      <Toaster position="top-right" theme="dark" />
      <BioreactorRoot />
    </div>
  );
}

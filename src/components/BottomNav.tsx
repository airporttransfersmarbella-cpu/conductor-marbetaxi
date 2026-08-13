import { Briefcase, Calendar, Receipt, Plug } from 'lucide-react';
import type { Tab } from '../App';

interface Props { tab: Tab; setTab: (t: Tab) => void; }

const items: { id: Tab; label: string; Icon: any }[] = [
  { id: 'jobboard',     label: 'Bolsa',        Icon: Briefcase },
  { id: 'myrides',      label: 'Mis viajes',   Icon: Calendar },
  { id: 'billing',      label: 'Facturación',  Icon: Receipt },
  { id: 'integrations', label: 'Integraciones',Icon: Plug },
];

export default function BottomNav({ tab, setTab }: Props) {
  return (
    <nav className="bottom-nav">
      {items.map(({ id, label, Icon }) => (
        <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  FileText,
  LayoutDashboard,
  MessageCircle,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

type NavItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', Icon: LayoutDashboard, end: true },
  { to: '/plantillas', label: 'Plantillas', Icon: FileText },
  { to: '/programaciones', label: 'Programaciones', Icon: CalendarClock },
  { to: '/dispositivos', label: 'Dispositivos', Icon: MessageCircle },
];

function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card p-4">
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;

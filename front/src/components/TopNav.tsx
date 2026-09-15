import { Bell, Calculator, Search, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

function TopNav() {
  return (
    <header className="flex items-center gap-4 border-b bg-card px-6 py-3">
      <div className="flex items-center gap-2 font-bold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Calculator className="size-4" />
        </span>
        <span className="text-lg">Cotizador 3000</span>
      </div>

      <div className="relative ml-4 hidden max-w-md flex-1 md:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar..."
          className="h-9 w-full rounded-full border bg-muted/40 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-full">
          <Bell className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full">
          <Settings className="size-4" />
        </Button>
        <Avatar>
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600">
            ME
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

export default TopNav;

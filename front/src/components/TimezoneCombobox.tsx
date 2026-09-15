import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Lista de zonas horarias IANA soportadas por el navegador. */
function getTimezones(): string[] {
  try {
    const fn = (
      Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf;
    if (typeof fn === 'function') return fn('timeZone');
  } catch {
    // Fallback abajo.
  }
  return [
    'UTC',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Argentina/Buenos_Aires',
    'America/Santiago',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/Madrid',
  ];
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Combobox con autocompletado para elegir una zona horaria IANA. */
function TimezoneCombobox({ id, value, onChange, placeholder }: Props) {
  const zones = useMemo(getTimezones, []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Al abrir, el input arranca vacío para poder filtrar; muestra el valor actual como placeholder.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    const list = q
      ? zones.filter((z) => z.toLowerCase().includes(q))
      : zones;
    return list.slice(0, 50);
  }, [zones, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const select = (zone: string) => {
    onChange(zone);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const zone = filtered[activeIndex];
      if (zone) select(zone);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={open ? query : value}
          placeholder={placeholder ?? value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          autoComplete="off"
          className="pr-9"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open ? (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">
              Sin coincidencias
            </li>
          ) : (
            filtered.map((zone, i) => (
              <li key={zone}>
                <button
                  type="button"
                  role="option"
                  aria-selected={zone === value}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(zone)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm',
                    i === activeIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      zone === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {zone}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default TimezoneCombobox;

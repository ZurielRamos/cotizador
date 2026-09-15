import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AccordionItemProps = {
  /** Contenido de la cabecera (siempre visible). */
  header: ReactNode;
  /** Contenido colapsable. */
  children: ReactNode;
  /** Abierto por defecto. */
  defaultOpen?: boolean;
  className?: string;
};

/** Item de acordeón autónomo (maneja su propio estado abierto/cerrado). */
function AccordionItem({
  header,
  children,
  defaultOpen = false,
  className,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
        <div className="min-w-0 flex-1">{header}</div>
      </button>
      {open ? <div className="border-t px-4 py-3">{children}</div> : null}
    </div>
  );
}

export { AccordionItem };

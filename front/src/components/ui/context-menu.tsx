import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Menú contextual ligero (click derecho) sin dependencias externas.
 * Uso:
 *   <ContextMenu content={<>...items...</>}>
 *     <tr>...</tr>
 *   </ContextMenu>
 * y dentro del content:
 *   <ContextMenuItem onSelect={...}>Editar</ContextMenuItem>
 */

type Pos = { x: number; y: number };

type Ctx = { close: () => void };
const MenuCtx = createContext<Ctx>({ close: () => {} });

type ContextMenuProps = {
  children: ReactNode;
  content: ReactNode;
  /** Si es true, no abre el menú (p. ej. cuando no hay acciones). */
  disabled?: boolean;
  /** Envoltura: por defecto un <div>. Útil para filas usar "tr". */
  as?: 'div' | 'tr';
  className?: string;
  /** Clase aplicada al trigger mientras el menú está abierto (estado activo). */
  activeClassName?: string;
};

function ContextMenu({
  children,
  content,
  disabled,
  as = 'div',
  className,
  activeClassName,
}: ContextMenuProps) {
  const [pos, setPos] = useState<Pos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPos(null), []);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [pos, close]);

  // Ajusta la posición para que no se salga de la ventana.
  const style = pos
    ? {
        top: Math.min(pos.y, window.innerHeight - 8),
        left: Math.min(pos.x, window.innerWidth - 200),
      }
    : undefined;

  const open = pos !== null;
  const commonProps = {
    onContextMenu: handleContextMenu,
    'data-state': open ? 'open' : 'closed',
    className: cn(className, open && activeClassName),
  };

  const trigger =
    as === 'tr' ? (
      <tr {...commonProps}>{children}</tr>
    ) : (
      <div {...commonProps}>{children}</div>
    );

  return (
    <MenuCtx.Provider value={{ close }}>
      {trigger}
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={style}
              className="fixed z-50 min-w-[190px] overflow-hidden rounded-md border bg-card p-1 shadow-lg"
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </MenuCtx.Provider>
  );
}

type ItemProps = {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Estilo destructivo (rojo) para acciones peligrosas. */
  variant?: 'default' | 'destructive';
  icon?: ReactNode;
};

function ContextMenuItem({
  children,
  onSelect,
  disabled,
  variant = 'default',
  icon,
}: ItemProps) {
  const { close } = useContext(MenuCtx);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        close();
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}

function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

export { ContextMenu, ContextMenuItem, ContextMenuSeparator };

import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type PageHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  /** Acciones personalizadas adicionales, se muestran antes del botón principal. */
  actions?: ReactNode;
};

function PageHeader({
  title,
  description,
  actionLabel,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {actionLabel ? (
          <Button>
            <Plus className="size-4" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default PageHeader;

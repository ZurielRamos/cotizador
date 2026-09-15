import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import PlantillaDialog from '@/components/PlantillaDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deletePlantilla,
  fetchPlantillas,
  type Plantilla,
} from '@/lib/plantillas';

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPorcentaje(tasa: number): string {
  return `${Math.round(tasa * 100)}%`;
}

function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPlantillas()
      .then(setPlantillas)
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? `No se pudieron cargar las plantillas: ${e.message}`
            : 'No se pudieron cargar las plantillas.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (p: Plantilla) => {
    if (!window.confirm(`¿Eliminar la plantilla #${p.numero}?`)) return;
    setDeletingId(p.id);
    try {
      await deletePlantilla(p.id);
      setPlantillas((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `No se pudo eliminar: ${e.message}`
          : 'No se pudo eliminar la plantilla.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Plantillas"
        description="Textos que los bots envían a los negocios para cotizar precios."
        actions={
          <PlantillaDialog
            onSaved={cargar}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nueva plantilla
              </Button>
            }
          />
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Cargando plantillas…
            </div>
          ) : plantillas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aún no hay plantillas. Crea la primera con “Nueva plantilla”.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Texto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Usada</TableHead>
                  <TableHead className="text-right">Respuestas</TableHead>
                  <TableHead className="text-right">Cotizaciones</TableHead>
                  <TableHead className="text-right">Efectividad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantillas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium tabular-nums text-muted-foreground">
                      #{p.numero}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={p.cuerpo}>
                        {p.cuerpo}
                      </div>
                    </TableCell>
                    <TableCell>{p.categoria}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.vecesUsada}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.respuestasRecibidas}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPorcentaje(p.tasaRespuesta)})
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.cotizacionesObtenidas}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatPorcentaje(p.tasaEfectividad)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.activa ? 'active' : 'scheduled'}>
                        {p.activa ? 'activa' : 'inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFecha(p.ultimoUsoEn)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PlantillaDialog
                          plantilla={p}
                          onSaved={cargar}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar plantilla #${p.numero}`}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar plantilla #${p.numero}`}
                          disabled={deletingId === p.id}
                          onClick={() => handleDelete(p)}
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PlantillasPage;

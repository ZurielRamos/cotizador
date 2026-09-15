import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createPlantilla,
  updatePlantilla,
  type Plantilla,
} from '@/lib/plantillas';

type Props = {
  /** Si se pasa, el diálogo edita esa plantilla; si no, crea una nueva. */
  plantilla?: Plantilla;
  /** Elemento que dispara la apertura del diálogo. */
  trigger: ReactNode;
  onSaved?: () => void;
};

function PlantillaDialog({ plantilla, trigger, onSaved }: Props) {
  const isEdit = Boolean(plantilla);
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [activa, setActiva] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, precarga los valores (edición) o resetea (creación).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCategoria(plantilla?.categoria ?? '');
    setCuerpo(plantilla?.cuerpo ?? '');
    setActiva(plantilla?.activa ?? true);
  }, [open, plantilla]);

  const handleSave = async () => {
    const cuerpoTrim = cuerpo.trim();

    if (!cuerpoTrim) {
      setError('El texto de la plantilla es obligatorio.');
      return;
    }

    const payload = {
      categoria: categoria.trim() || undefined,
      cuerpo: cuerpoTrim,
      activa,
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit && plantilla) {
        await updatePlantilla(plantilla.id, payload);
      } else {
        await createPlantilla(payload);
      }
      setOpen(false);
      onSaved?.();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar la plantilla.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar plantilla #${plantilla?.numero}` : 'Nueva plantilla'}
          </DialogTitle>
          <DialogDescription>
            Solo escribe el texto que los bots envían a los negocios para pedir
            cotizaciones. Puedes usar variables como {'{{nombre}}'} que el bot
            reemplaza antes de enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="pl-cuerpo">Texto de la plantilla</Label>
            <Textarea
              id="pl-cuerpo"
              rows={6}
              placeholder="Hola, ¿me podría cotizar el precio del saco de cemento?"
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pl-categoria">Categoría (opcional)</Label>
            <Input
              id="pl-categoria"
              placeholder="Cemento"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
            />
            Activa
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PlantillaDialog;

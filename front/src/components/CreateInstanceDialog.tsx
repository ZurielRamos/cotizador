import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
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
import { createInstance, type CreateInstanceResult } from '@/lib/evolutionApi';

type Props = {
  onCreated: (result: CreateInstanceResult) => void;
};

function CreateInstanceDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre de la instancia es obligatorio.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Solo letras, números, guiones y guiones bajos.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await createInstance(trimmed);
      setOpen(false);
      setName('');
      onCreated(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la instancia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nueva instancia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva instancia</DialogTitle>
          <DialogDescription>
            Crea una instancia de WhatsApp en Evolution API. Después escanea el
            QR para vincular un número.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="instance-name">Nombre de la instancia</Label>
          <Input
            id="instance-name"
            placeholder="ventas-mx"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateInstanceDialog;

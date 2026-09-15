import { Loader2, Upload, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  updateProfileName,
  updateProfilePicture,
  updateProfileStatus,
  type Instance,
} from '@/lib/evolutionApi';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type Props = {
  instance: Instance;
  /** Trigger opcional. Si se omite, el diálogo se controla con open/onOpenChange. */
  trigger?: React.ReactNode;
  /** Estado controlado (opcional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
};

function EditProfileDialog({
  instance,
  trigger,
  open: openProp,
  onOpenChange,
  onSaved,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const [nombre, setNombre] = useState('');
  const [status, setStatus] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Al abrir, precarga el perfil actual y limpia la selección de foto.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setNombre(instance.profileName ?? '');
    setStatus('');
    setFile(null);
    setPreview(null);
  }, [open, instance]);

  // Libera el object URL del preview cuando cambia o se cierra.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = (selected: File | null) => {
    setError(null);
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError('La imagen no puede superar los 5 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSave = async () => {
    const nombreTrim = nombre.trim();
    const statusTrim = status.trim();
    const nombreCambio =
      nombreTrim !== '' && nombreTrim !== (instance.profileName ?? '');

    if (!nombreCambio && statusTrim === '' && !file) {
      setError('No hay cambios que guardar.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Se ejecutan en secuencia para reportar un error claro por campo.
      if (nombreCambio) {
        await updateProfileName(instance.name, nombreTrim);
      }
      if (statusTrim !== '') {
        await updateProfileStatus(instance.name, statusTrim);
      }
      if (file) {
        await updateProfilePicture(instance.name, file);
      }
      setOpen(false);
      onSaved?.();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo actualizar el perfil.',
      );
    } finally {
      setSaving(false);
    }
  };

  const avatarActual = preview ?? instance.profilePicUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil de WhatsApp</DialogTitle>
          <DialogDescription>
            Cambia el nombre, el estado y la foto de perfil de la instancia{' '}
            <strong>{instance.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full border bg-muted">
              {avatarActual ? (
                <img
                  src={avatarActual}
                  alt="Foto de perfil"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <UserRound className="size-8" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {file ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {file ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG o PNG, máx. 5 MB.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perfil-nombre">Nombre del perfil</Label>
            <Input
              id="perfil-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ventas México"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="perfil-status">Estado / recado</Label>
            <Textarea
              id="perfil-status"
              rows={2}
              maxLength={139}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Dejar en blanco para no cambiarlo"
            />
            <p className="text-xs text-muted-foreground">
              El estado actual no se puede leer desde la API; escribe uno nuevo
              solo si quieres reemplazarlo.
            </p>
          </div>

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
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditProfileDialog;

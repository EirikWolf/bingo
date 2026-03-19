import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';
import { createLocation } from '@/services/actions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { locations, loading, initialize } = useLocationStore();
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  // Access control: only superadmin
  if (!user || user.role !== 'superadmin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-red-600 font-medium">Ingen tilgang</p>
        <p className="text-sm text-gray-500 mt-1">Du må ha superadmin-rettigheter for å se denne siden.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Tilbake</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-bingo-600 text-sm">
            ← Tilbake
          </button>
          <h1 className="font-semibold text-gray-900">Superadmin</h1>
          <Badge variant="warning">Superadmin</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Lokasjoner</h2>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            + Ny lokasjon
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : locations.length === 0 ? (
          <Card className="text-center">
            <p className="text-gray-500">Ingen lokasjoner opprettet ennå.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <Card key={loc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/${loc.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                    {loc.description && (
                      <p className="mt-0.5 text-sm text-gray-500">{loc.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {loc.adminUids.length} admin(s) · {loc.playerCount} spillere
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {loc.activeGameId ? (
                      <Badge variant="success">Aktivt spill</Badge>
                    ) : (
                      <Badge variant="default">Ingen spill</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateLocationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        superadminUid={user.uid}
      />
    </div>
  );
}

interface CreateLocationModalProps {
  open: boolean;
  onClose: () => void;
  superadminUid: string;
}

function CreateLocationModal({ open, onClose, superadminUid }: CreateLocationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      await createLocation(name.trim(), description.trim(), [superadminUid]);
      toast.success(`Lokasjon "${name.trim()}" opprettet!`);
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Create location error:', error);
      toast.error('Kunne ikke opprette lokasjon');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Opprett lokasjon">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label htmlFor="loc-name" className="block text-sm font-medium text-gray-700">
            Navn
          </label>
          <input
            id="loc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-2 focus:ring-bingo-500"
            placeholder="F.eks. Gneist IL"
            required
          />
        </div>
        <div>
          <label htmlFor="loc-desc" className="block text-sm font-medium text-gray-700">
            Beskrivelse
          </label>
          <input
            id="loc-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-2 focus:ring-bingo-500"
            placeholder="Valgfri beskrivelse"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" className="flex-1" loading={creating}>
            Opprett
          </Button>
        </div>
      </form>
    </Modal>
  );
}

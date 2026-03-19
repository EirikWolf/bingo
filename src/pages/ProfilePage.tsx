import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { listenToUserCommitments } from '@/services/firestore';
import { updateUserProfile } from '@/services/actions';
import { signOut } from '@/services/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import type { Commitment, CommitmentStatus } from '@/types';

const STATUS_LABELS: Record<CommitmentStatus, string> = {
  pending: 'Ventende',
  confirmed: 'Bekreftet',
  overdue: 'Forfalt',
  cancelled: 'Kansellert',
};

const STATUS_VARIANT: Record<CommitmentStatus, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  confirmed: 'success',
  overdue: 'error',
  cancelled: 'default',
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToUserCommitments(user.uid, (data) => {
      setCommitments(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  function startEditing() {
    if (!user) return;
    setEditName(user.displayName ?? '');
    setEditPhone(user.phone ?? '');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function handleSaveProfile() {
    if (!user || !editName.trim()) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: editName.trim(),
        phone: editPhone.trim() || null,
      });
      toast.success('Profilen er oppdatert!');
      setEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Kunne ikke oppdatere profilen');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-gray-500">Du må være logget inn for å se profilen din.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Tilbake</Button>
      </div>
    );
  }

  const pendingCount = commitments.filter((c) => c.status === 'pending').length;
  const confirmedCount = commitments.filter((c) => c.status === 'confirmed').length;
  const overdueCount = commitments.filter((c) => c.status === 'overdue').length;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-bingo-600 text-sm">
            ← Tilbake
          </button>
          <h1 className="font-semibold text-gray-900">Min profil</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* User info */}
        <Card>
          {!editing ? (
            <>
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bingo-100 text-bingo-600 font-bold text-lg">
                    {user.displayName?.charAt(0) ?? '?'}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{user.displayName}</p>
                  {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
                  {user.phone ? (
                    <p className="text-sm text-gray-500">{user.phone}</p>
                  ) : (
                    <p className="text-sm text-orange-500">Telefonnummer mangler</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startEditing}
                >
                  Rediger
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleSignOut}
              >
                Logg ut
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Navn
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefonnummer
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="F.eks. 91234567"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
                />
              </div>
              {user.email && (
                <p className="text-xs text-gray-400">E-post: {user.email} (kan ikke endres)</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Avbryt
                </Button>
                <Button
                  className="flex-1"
                  loading={saving}
                  disabled={!editName.trim()}
                  onClick={handleSaveProfile}
                >
                  Lagre
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Commitment summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
          <Card padding="sm">
            <p className="text-gray-400">Totalt</p>
            <p className="text-xl font-bold text-gray-900">{commitments.length}</p>
          </Card>
          <Card padding="sm">
            <p className="text-gray-400">Ventende</p>
            <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
          </Card>
          <Card padding="sm">
            <p className="text-gray-400">Forfalt</p>
            <p className="text-xl font-bold text-red-600">{overdueCount}</p>
          </Card>
          <Card padding="sm">
            <p className="text-gray-400">Fullført</p>
            <p className="text-xl font-bold text-green-600">{confirmedCount}</p>
          </Card>
        </div>

        {/* Commitments list */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mine forpliktelser</h2>

          {loading && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}

          {!loading && commitments.length === 0 && (
            <p className="text-gray-400 text-center py-4">
              Du har ingen forpliktelser ennå.
            </p>
          )}

          <div className="space-y-2">
            {commitments.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{c.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <button
                        className="text-bingo-600 hover:underline"
                        onClick={() => navigate(`/spill/${c.locationId}`)}
                      >
                        {c.locationName}
                      </button>
                      {' — '}{c.createdAt?.toDate().toLocaleDateString('nb-NO') ?? ''}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[c.status]}>
                    {STATUS_LABELS[c.status]}
                  </Badge>
                </div>
                {c.status === 'confirmed' && c.confirmedAt && (
                  <p className="text-xs text-green-600 mt-1">
                    Bekreftet {c.confirmedAt.toDate().toLocaleDateString('nb-NO')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}

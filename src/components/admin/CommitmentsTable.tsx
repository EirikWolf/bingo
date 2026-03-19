import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { listenToLocationCommitments } from '@/services/firestore';
import { updateCommitmentStatus, batchConfirmCommitments } from '@/services/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Commitment, CommitmentStatus } from '@/types';

interface CommitmentsTableProps {
  locationId: string;
  adminUid: string;
  locationName: string;
  vippsNumber: string | null;
  vippsDefaultAmount: number | null;
}

type SortField = 'date' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

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

function buildSmsLink(phone: string, name: string, description: string, locationName: string): string {
  const body = `Hei ${name}! Påminnelse om din forpliktelse "${description}" for ${locationName}. Ta kontakt om du har spørsmål.`;
  return `sms:${phone}?body=${encodeURIComponent(body)}`;
}

function buildVippsLink(vippsNumber: string, amount: number | null): string {
  const params = new URLSearchParams({ number: vippsNumber });
  if (amount) params.set('amount', String(amount * 100)); // Vipps uses oere
  return `vipps://send?${params.toString()}`;
}

export function CommitmentsTable({ locationId, adminUid, locationName, vippsNumber, vippsDefaultAmount }: CommitmentsTableProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<CommitmentStatus | 'all'>('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection for batch operations
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  useEffect(() => {
    const unsub = listenToLocationCommitments(locationId, (data) => {
      setCommitments(data);
      setLoading(false);
    });
    return unsub;
  }, [locationId]);

  // Filtered + sorted commitments
  const displayed = useMemo(() => {
    let result = [...commitments];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }

    // Filter by search (name, phone, description)
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.userDisplayName.toLowerCase().includes(q) ||
          (c.userPhone && c.userPhone.includes(q)) ||
          c.description.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
      } else if (sortField === 'name') {
        cmp = a.userDisplayName.localeCompare(b.userDisplayName, 'nb');
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [commitments, filterStatus, filterSearch, sortField, sortDir]);

  // Toggle sort
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  // Selection handlers
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pendingIds = displayed.filter((c) => c.status === 'pending').map((c) => c.id);
    const allSelected = pendingIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  }

  // Batch confirm
  async function handleBatchConfirm() {
    if (selected.size === 0) return;
    setBatchProcessing(true);
    try {
      await batchConfirmCommitments([...selected], adminUid);
      toast.success(`${selected.size} forpliktelser bekreftet`);
      setSelected(new Set());
    } catch (error) {
      console.error('Batch confirm error:', error);
      toast.error('Kunne ikke bekrefte forpliktelser');
    } finally {
      setBatchProcessing(false);
    }
  }

  // Single status change
  async function handleStatusChange(id: string, status: 'confirmed' | 'cancelled') {
    try {
      await updateCommitmentStatus(id, status, adminUid);
      toast.success(status === 'confirmed' ? 'Bekreftet' : 'Kansellert');
    } catch (error) {
      console.error('Status change error:', error);
      toast.error('Kunne ikke endre status');
    }
  }

  // CSV export
  function exportCSV() {
    const headers = ['Navn', 'Telefon', 'Beskrivelse', 'Status', 'Spill', 'Dato'];
    const rows = displayed.map((c) => [
      c.userDisplayName,
      c.userPhone ?? '',
      c.description,
      STATUS_LABELS[c.status],
      c.gameId,
      c.createdAt?.toDate().toLocaleDateString('nb-NO') ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forpliktelser-${locationId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <Card className="text-center"><p className="text-gray-400">Laster forpliktelser...</p></Card>;
  }

  const pendingCount = commitments.filter((c) => c.status === 'pending').length;
  const confirmedCount = commitments.filter((c) => c.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm">
        <Card padding="sm">
          <p className="text-gray-400">Totalt</p>
          <p className="text-xl font-bold text-gray-900">{commitments.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Ventende</p>
          <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-gray-400">Bekreftet</p>
          <p className="text-xl font-bold text-green-600">{confirmedCount}</p>
        </Card>
      </div>

      {/* Filters + actions bar */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="Søk navn, telefon..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="flex-1 min-w-[140px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bingo-500 focus:outline-none"
          />

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CommitmentStatus | 'all')}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-bingo-500 focus:outline-none"
          >
            <option value="all">Alle statuser</option>
            <option value="pending">Ventende</option>
            <option value="confirmed">Bekreftet</option>
            <option value="cancelled">Kansellert</option>
          </select>

          {/* CSV export */}
          <Button size="sm" variant="secondary" onClick={exportCSV} disabled={displayed.length === 0}>
            Eksporter CSV
          </Button>
        </div>

        {/* Batch actions */}
        {selected.size > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-bingo-50 p-2">
            <span className="text-sm text-bingo-700">{selected.size} valgt</span>
            <Button
              size="sm"
              loading={batchProcessing}
              onClick={handleBatchConfirm}
              className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
            >
              Bekreft alle
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Avbryt
            </Button>
          </div>
        )}
      </Card>

      {/* Table header */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={displayed.filter((c) => c.status === 'pending').length > 0 &&
                      displayed.filter((c) => c.status === 'pending').every((c) => selected.has(c.id))}
                    className="h-4 w-4 rounded border-gray-300 text-bingo-600 focus:ring-bingo-500"
                  />
                </th>
                <th className="px-3 py-2 cursor-pointer hover:text-gray-700" onClick={() => handleSort('name')}>
                  Navn {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 hidden sm:table-cell">Beskrivelse</th>
                <th className="px-3 py-2 cursor-pointer hover:text-gray-700" onClick={() => handleSort('status')}>
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 cursor-pointer hover:text-gray-700" onClick={() => handleSort('date')}>
                  Dato {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 w-24">Handling</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    Ingen forpliktelser funnet
                  </td>
                </tr>
              )}
              {displayed.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {c.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 rounded border-gray-300 text-bingo-600 focus:ring-bingo-500"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{c.userDisplayName}</p>
                    {c.userPhone && (
                      <p className="text-xs text-gray-400">{c.userPhone}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell text-gray-600 max-w-[200px] truncate">
                    {c.description}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[c.status]}>
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {c.createdAt?.toDate().toLocaleDateString('nb-NO') ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {c.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(c.id, 'confirmed')}
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100"
                            title="Bekreft"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleStatusChange(c.id, 'cancelled')}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100"
                            title="Kanseller"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {c.userPhone && (
                        <a
                          href={buildSmsLink(c.userPhone, c.userDisplayName, c.description, locationName)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                          title="Send SMS-påminnelse"
                        >
                          SMS
                        </a>
                      )}
                      {vippsNumber && (
                        <a
                          href={buildVippsLink(vippsNumber, vippsDefaultAmount)}
                          className="rounded px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
                          title="Åpne Vipps"
                        >
                          Vipps
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

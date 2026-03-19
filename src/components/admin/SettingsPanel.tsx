import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { updateLocationSettings, addLocationAdmin, removeLocationAdmin } from '@/services/actions';
import { fetchUsersByUids, listenToLeaderboard } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Location, User, LeaderboardEntry } from '@/types';

interface SettingsPanelProps {
  location: Location;
  locationId: string;
  currentUserId: string;
}

export function SettingsPanel({ location, locationId, currentUserId }: SettingsPanelProps) {
  const s = location.settings;

  const [vippsNumber, setVippsNumber] = useState(s.vippsNumber ?? '');
  const [vippsAmount, setVippsAmount] = useState(s.vippsDefaultAmount?.toString() ?? '');
  const [pricingEnabled, setPricingEnabled] = useState(s.couponPricing?.enabled ?? false);
  const [pricePerCoupon, setPricePerCoupon] = useState(s.couponPricing?.pricePerCoupon?.toString() ?? '');
  const [defaultCommitment, setDefaultCommitment] = useState(s.defaultCommitment);
  const [maxCoupons, setMaxCoupons] = useState(s.maxCouponsPerPlayer.toString());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Admin management state
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardEntry[]>([]);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);

  const creatorUid = location.adminUids[0] ?? '';

  // Fetch admin user profiles
  useEffect(() => {
    if (location.adminUids.length === 0) return;
    fetchUsersByUids(location.adminUids).then(setAdminUsers).catch(console.error);
  }, [location.adminUids]);

  // Listen to leaderboard for promotable players
  useEffect(() => {
    return listenToLeaderboard(locationId, setLeaderboardPlayers);
  }, [locationId]);

  const promotablePlayers = leaderboardPlayers.filter(
    (p) => !location.adminUids.includes(p.userId)
  );

  async function handleAddAdmin(uid: string, displayName: string) {
    setAddingUid(uid);
    try {
      await addLocationAdmin(locationId, uid);
      toast.success(`${displayName} er nå administrator`);
    } catch (error) {
      console.error('Add admin error:', error);
      toast.error('Kunne ikke legge til administrator');
    } finally {
      setAddingUid(null);
    }
  }

  async function handleRemoveAdmin(uid: string, displayName: string) {
    setRemovingUid(uid);
    try {
      await removeLocationAdmin(locationId, uid, creatorUid);
      toast.success(`${displayName} er fjernet som administrator`);
    } catch (error) {
      console.error('Remove admin error:', error);
      toast.error(error instanceof Error ? error.message : 'Kunne ikke fjerne administrator');
    } finally {
      setRemovingUid(null);
      setConfirmRemoveUid(null);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const maxCouponsNum = Number(maxCoupons);
    const amountNum = vippsAmount ? Number(vippsAmount) : null;

    if (maxCoupons !== '' && (isNaN(maxCouponsNum) || maxCouponsNum < 0)) {
      errs.maxCoupons = 'Må være 0 eller høyere';
    }
    if (amountNum !== null && (isNaN(amountNum) || amountNum < 0)) {
      errs.vippsAmount = 'Må være et positivt tall';
    }
    if (pricingEnabled && (!pricePerCoupon || isNaN(Number(pricePerCoupon)) || Number(pricePerCoupon) <= 0)) {
      errs.pricePerCoupon = 'Pris per kupong må være et positivt tall';
    }
    if (!defaultCommitment.trim()) {
      errs.defaultCommitment = 'Kan ikke være tom';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateLocationSettings(locationId, {
        vippsNumber: vippsNumber.trim() || null,
        vippsDefaultAmount: vippsAmount ? Number(vippsAmount) : null,
        couponPricing: pricingEnabled
          ? { enabled: true, pricePerCoupon: Number(pricePerCoupon) || 0 }
          : null,
        defaultCommitment,
        maxCouponsPerPlayer: Number(maxCoupons) || 0,
      });
      toast.success('Innstillinger lagret');
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('Kunne ikke lagre innstillinger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Admin management */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Administratorer</h3>

        {/* Current admins */}
        <div className="space-y-2 mb-4">
          {adminUsers.map((admin) => {
            const isCreator = admin.uid === creatorUid;
            const isSelf = admin.uid === currentUserId;
            return (
              <div
                key={admin.uid}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bingo-100 text-sm font-bold text-bingo-700">
                    {admin.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {admin.displayName}
                      {isSelf && <span className="text-gray-400 ml-1">(deg)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCreator ? (
                    <Badge variant="info">Oppretter</Badge>
                  ) : confirmRemoveUid === admin.uid ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRemoveAdmin(admin.uid, admin.displayName)}
                        disabled={removingUid === admin.uid}
                        className="text-xs text-red-600 font-medium hover:underline"
                      >
                        {removingUid === admin.uid ? 'Fjerner...' : 'Bekreft'}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveUid(null)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveUid(admin.uid)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Fjern
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add admin from leaderboard */}
        {promotablePlayers.length > 0 ? (
          <div>
            <p className="text-sm text-gray-600 mb-2">Legg til administrator</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {promotablePlayers.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {player.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{player.displayName}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={addingUid === player.userId}
                    onClick={() => handleAddAdmin(player.userId, player.displayName)}
                  >
                    Legg til
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Ingen spillere å legge til. Spillere vises her etter at de har deltatt i et spill.
          </p>
        )}
      </Card>

      {/* Vipps settings */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Vipps</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="vipps-number" className="block text-sm text-gray-600 mb-1">
              Vipps-nummer
            </label>
            <input
              id="vipps-number"
              type="tel"
              value={vippsNumber}
              onChange={(e) => setVippsNumber(e.target.value)}
              placeholder="F.eks. 12345678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Brukes for Vipps-betaling i kupongkjøp og forpliktelseslisten
            </p>
          </div>
          <div>
            <label htmlFor="vipps-amount" className="block text-sm text-gray-600 mb-1">
              Standardbeløp (kr)
            </label>
            <input
              id="vipps-amount"
              type="number"
              value={vippsAmount}
              onChange={(e) => { setVippsAmount(e.target.value); if (errors.vippsAmount) setErrors((p) => { const n = { ...p }; delete n.vippsAmount; return n; }); }}
              placeholder="Valgfritt"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${errors.vippsAmount ? 'border-red-300' : 'border-gray-300 focus:border-bingo-500'}`}
            />
            {errors.vippsAmount && <p className="text-xs text-red-500 mt-1">{errors.vippsAmount}</p>}
          </div>
        </div>
      </Card>

      {/* Coupon pricing */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Kupongprising</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pricingEnabled}
              onChange={(e) => setPricingEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-bingo-600 focus:ring-bingo-500"
            />
            <span className="text-sm text-gray-700">Tillat betaling med Vipps</span>
          </label>
          {pricingEnabled && (
            <>
              <div>
                <label htmlFor="price-per-coupon" className="block text-sm text-gray-600 mb-1">
                  Pris per kupong (kr)
                </label>
                <input
                  id="price-per-coupon"
                  type="number"
                  min="1"
                  value={pricePerCoupon}
                  onChange={(e) => { setPricePerCoupon(e.target.value); if (errors.pricePerCoupon) setErrors((p) => { const n = { ...p }; delete n.pricePerCoupon; return n; }); }}
                  placeholder="F.eks. 20"
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${errors.pricePerCoupon ? 'border-red-300' : 'border-gray-300 focus:border-bingo-500'}`}
                />
                {errors.pricePerCoupon && <p className="text-xs text-red-500 mt-1">{errors.pricePerCoupon}</p>}
              </div>
              <p className="text-xs text-gray-400">
                Når aktivert kan spillere velge mellom forpliktelse eller Vipps-betaling ved kupongkjøp.
                {!vippsNumber.trim() && (
                  <span className="text-orange-500"> Du må fylle inn Vipps-nummer over for at dette skal fungere.</span>
                )}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Game settings */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Spillinnstillinger</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="default-commitment" className="block text-sm text-gray-600 mb-1">
              Standard forpliktelse
            </label>
            <input
              id="default-commitment"
              type="text"
              value={defaultCommitment}
              onChange={(e) => { setDefaultCommitment(e.target.value); if (errors.defaultCommitment) setErrors((p) => { const n = { ...p }; delete n.defaultCommitment; return n; }); }}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${errors.defaultCommitment ? 'border-red-300' : 'border-gray-300 focus:border-bingo-500'}`}
            />
            {errors.defaultCommitment && <p className="text-xs text-red-500 mt-1">{errors.defaultCommitment}</p>}
          </div>
          <div>
            <label htmlFor="max-coupons" className="block text-sm text-gray-600 mb-1">
              Maks kuponger per spiller (0 = ubegrenset)
            </label>
            <input
              id="max-coupons"
              type="number"
              min="0"
              value={maxCoupons}
              onChange={(e) => { setMaxCoupons(e.target.value); if (errors.maxCoupons) setErrors((p) => { const n = { ...p }; delete n.maxCoupons; return n; }); }}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${errors.maxCoupons ? 'border-red-300' : 'border-gray-300 focus:border-bingo-500'}`}
            />
            {errors.maxCoupons && <p className="text-xs text-red-500 mt-1">{errors.maxCoupons}</p>}
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} loading={saving} className="w-full">
        Lagre innstillinger
      </Button>
    </div>
  );
}

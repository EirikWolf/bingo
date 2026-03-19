import { useState } from 'react';
import toast from 'react-hot-toast';
import { updateLocationSettings } from '@/services/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Location } from '@/types';

interface SettingsPanelProps {
  location: Location;
  locationId: string;
}

export function SettingsPanel({ location, locationId }: SettingsPanelProps) {
  const s = location.settings;

  const [vippsNumber, setVippsNumber] = useState(s.vippsNumber ?? '');
  const [vippsAmount, setVippsAmount] = useState(s.vippsDefaultAmount?.toString() ?? '');
  const [defaultCommitment, setDefaultCommitment] = useState(s.defaultCommitment);
  const [maxCoupons, setMaxCoupons] = useState(s.maxCouponsPerPlayer.toString());
  const [autoDrawInterval, setAutoDrawInterval] = useState((s.autoDrawIntervalMs / 1000).toString());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const maxCouponsNum = Number(maxCoupons);
    const intervalNum = Number(autoDrawInterval);
    const amountNum = vippsAmount ? Number(vippsAmount) : null;

    if (maxCoupons !== '' && (isNaN(maxCouponsNum) || maxCouponsNum < 0)) {
      errs.maxCoupons = 'Må være 0 eller høyere';
    }
    if (isNaN(intervalNum) || intervalNum < 3 || intervalNum > 30) {
      errs.autoDrawInterval = 'Må være mellom 3 og 30 sekunder';
    }
    if (amountNum !== null && (isNaN(amountNum) || amountNum < 0)) {
      errs.vippsAmount = 'Må være et positivt tall';
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
        defaultCommitment,
        maxCouponsPerPlayer: Number(maxCoupons) || 0,
        autoDrawIntervalMs: (Number(autoDrawInterval) || 5) * 1000,
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
              Brukes for "Betal via Vipps"-knappen i forpliktelseslisten
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
          <div>
            <label htmlFor="draw-interval" className="block text-sm text-gray-600 mb-1">
              Auto-trekning intervall (sekunder)
            </label>
            <input
              id="draw-interval"
              type="number"
              min="3"
              max="30"
              value={autoDrawInterval}
              onChange={(e) => { setAutoDrawInterval(e.target.value); if (errors.autoDrawInterval) setErrors((p) => { const n = { ...p }; delete n.autoDrawInterval; return n; }); }}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${errors.autoDrawInterval ? 'border-red-300' : 'border-gray-300 focus:border-bingo-500'}`}
            />
            {errors.autoDrawInterval && <p className="text-xs text-red-500 mt-1">{errors.autoDrawInterval}</p>}
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} loading={saving} className="w-full">
        Lagre innstillinger
      </Button>
    </div>
  );
}

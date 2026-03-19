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

  async function handleSave() {
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
              onChange={(e) => setVippsAmount(e.target.value)}
              placeholder="Valgfritt"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
            />
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
              onChange={(e) => setDefaultCommitment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
            />
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
              onChange={(e) => setMaxCoupons(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
            />
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
              onChange={(e) => setAutoDrawInterval(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} loading={saving} className="w-full">
        Lagre innstillinger
      </Button>
    </div>
  );
}

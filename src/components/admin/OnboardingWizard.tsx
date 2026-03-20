import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { createLocation, updateLocationSettings } from '@/services/actions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

type Step = 'welcome' | 'name' | 'commitment' | 'settings' | 'done';

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultCommitment, setDefaultCommitment] = useState('1 time dugnad per kupong');
  const [maxCoupons, setMaxCoupons] = useState('3');
  const [creating, setCreating] = useState(false);
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const locationId = await createLocation(name.trim(), description.trim(), [userId]);

      // Update settings with wizard values
      await updateLocationSettings(locationId, {
        defaultCommitment: defaultCommitment.trim() || '1 time dugnad per kupong',
        maxCouponsPerPlayer: parseInt(maxCoupons, 10) || 0,
      });

      setCreatedLocationId(locationId);
      setStep('done');
      toast.success(`"${name.trim()}" er opprettet!`);
    } catch (error) {
      console.error('Onboarding create error:', error);
      toast.error('Kunne ikke opprette lokasjon');
    } finally {
      setCreating(false);
    }
  }

  const stepIndicator = (
    <div className="flex justify-center gap-2 mb-6">
      {['welcome', 'name', 'commitment', 'settings', 'done'].map((s, i) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all ${
            s === step ? 'w-8 bg-bingo-600' : i < ['welcome', 'name', 'commitment', 'settings', 'done'].indexOf(step) ? 'w-2 bg-bingo-400' : 'w-2 bg-gray-300 dark:bg-gray-600'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-md px-4">
      {stepIndicator}

      {step === 'welcome' && (
        <Card className="text-center">
          <div className="text-4xl mb-4">🎱</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Velkommen til BingoPortalen!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            La oss sette opp din første bingolokasjon. Det tar bare et minutt.
          </p>
          <Button onClick={() => setStep('name')} className="w-full">
            Kom i gang
          </Button>
        </Card>
      )}

      {step === 'name' && (
        <Card>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Hva heter lokalet?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Gi lokalet et navn som spillerne kjenner igjen.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
              placeholder="F.eks. Gneist IL, Bygdehuset, Skolens bingokveld"
              autoFocus
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
              placeholder="Valgfri beskrivelse"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStep('welcome')} className="flex-1">
              Tilbake
            </Button>
            <Button onClick={() => setStep('commitment')} disabled={!name.trim()} className="flex-1">
              Neste
            </Button>
          </div>
        </Card>
      )}

      {step === 'commitment' && (
        <Card>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Hva er forpliktelsen?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Hva forplikter spillerne seg til for hver kupong de kjøper? Du kan endre dette senere.
          </p>
          <input
            type="text"
            value={defaultCommitment}
            onChange={(e) => setDefaultCommitment(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-1 focus:ring-bingo-500"
            placeholder="F.eks. 1 time dugnad per kupong"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {['1 time dugnad per kupong', 'Kake til neste møte', '50 kr til klassekassen'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setDefaultCommitment(suggestion)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  defaultCommitment === suggestion
                    ? 'bg-bingo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStep('name')} className="flex-1">
              Tilbake
            </Button>
            <Button onClick={() => setStep('settings')} className="flex-1">
              Neste
            </Button>
          </div>
        </Card>
      )}

      {step === 'settings' && (
        <Card>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            Kuponger per spiller
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Hvor mange kuponger kan hver spiller kjøpe per spill? Sett til 0 for ubegrenset.
          </p>
          <div className="flex items-center gap-3">
            {['1', '3', '5', '0'].map((val) => (
              <button
                key={val}
                onClick={() => setMaxCoupons(val)}
                className={`flex-1 rounded-lg py-3 text-center font-bold transition-colors ${
                  maxCoupons === val
                    ? 'bg-bingo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {val === '0' ? '∞' : val}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStep('commitment')} className="flex-1">
              Tilbake
            </Button>
            <Button onClick={handleCreate} loading={creating} className="flex-1">
              Opprett lokasjon
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && createdLocationId && (
        <Card className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Lokasjon opprettet!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            &quot;{name}&quot; er klar. Nå kan du opprette ditt første spill.
          </p>
          <div className="space-y-2">
            <Button onClick={() => navigate(`/admin/${createdLocationId}`)} className="w-full">
              Gå til administrasjon
            </Button>
            <Button variant="secondary" onClick={onComplete} className="w-full">
              Tilbake til forsiden
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/Button';

interface QrCodeSectionProps {
  locationId: string;
  locationName: string;
}

/** Stable production URL — always use the public hostname */
function getPlayerUrl(locationId: string): string {
  // Use origin in production, fallback for dev
  const origin = window.location.hostname === 'localhost'
    ? 'https://bingoportalen.web.app'
    : window.location.origin;
  return `${origin}/spill/${locationId}`;
}

export function QrCodeSection({ locationId, locationName }: QrCodeSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerUrl = getPlayerUrl(locationId);

  const handleDownloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `bingo-qr-${locationName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }, [locationName]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(playerUrl);
    } catch {
      // Fallback: select + copy
      const input = document.createElement('input');
      input.value = playerUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  }, [playerUrl]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Canvas-based QR for accurate PNG download */}
      <div className="rounded-lg bg-white p-4 border border-gray-200">
        <QRCodeCanvas
          ref={canvasRef}
          value={playerUrl}
          size={200}
          level="M"
          includeMargin
          marginSize={2}
        />
      </div>

      <p className="text-sm text-gray-500 text-center">
        Skann for å komme direkte til spillet
      </p>

      <p className="text-xs text-gray-400 break-all text-center select-all">
        {playerUrl}
      </p>

      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleDownloadPng}>
          Last ned PNG
        </Button>
        <Button size="sm" variant="secondary" onClick={handleCopyUrl}>
          Kopier lenke
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Skriv ut QR-koden og heng den opp i lokalet, eller del lenken direkte.
      </p>
    </div>
  );
}

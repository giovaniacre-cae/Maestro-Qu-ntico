import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, Volume2, VolumeX, X, CheckCircle2, Smartphone, Sliders } from 'lucide-react';

interface NorthCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphicTitle?: string;
}

type SensorMode = 'auto' | 'manual';
type SensorStatus =
  | 'initializing'
  | 'active'
  | 'permission-required'
  | 'unavailable'
  | 'manual';

interface DeviceOrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationStaticWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

function getCardinalLabel(deg: number): string {
  const d = normalizeAngle(deg);
  if (d >= 337.5 || d < 22.5) return 'Norte (N)';
  if (d < 67.5) return 'Nordeste (NE)';
  if (d < 112.5) return 'Leste (L)';
  if (d < 157.5) return 'Sudeste (SE)';
  if (d < 202.5) return 'Sul (S)';
  if (d < 247.5) return 'Sudoeste (SO)';
  if (d < 292.5) return 'Oeste (O)';
  return 'Nordeste / Noroeste (NO)';
}

function playGentleAlignmentChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(792, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.46);
    osc2.stop(now + 0.46);

    setTimeout(() => {
      void ctx.close();
    }, 600);
  } catch {
    // Audio playback blocked or unsupported
  }
}

export const NorthCompassModal: React.FC<NorthCompassModalProps> = ({
  isOpen,
  onClose,
  graphicTitle,
}) => {
  const [heading, setHeading] = useState<number>(357);
  const [sensorMode, setSensorMode] = useState<SensorMode>('auto');
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>('initializing');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isAbsoluteSource, setIsAbsoluteSource] = useState<boolean>(false);

  const wasAlignedRef = useRef<boolean>(false);
  const receivedReadingRef = useRef<boolean>(false);

  const normalizedHeading = normalizeAngle(Math.round(heading));
  const isAligned = normalizedHeading >= 354 || normalizedHeading <= 3;

  // Shortest signed angular error relative to 357° (-180..180)
  const deltaFrom357 = (() => {
    let diff = 357 - normalizedHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  })();

  const startListeners = useCallback(() => {
    if (typeof window === 'undefined') return () => {};

    receivedReadingRef.current = false;
    setSensorStatus('initializing');

    const handleOrientation = (ev: Event, absoluteEvent: boolean) => {
      const event = ev as DeviceOrientationEventWithCompass;
      let resolved: number | null = null;

      if (
        typeof event.webkitCompassHeading === 'number' &&
        !Number.isNaN(event.webkitCompassHeading)
      ) {
        resolved = normalizeAngle(event.webkitCompassHeading);
        setIsAbsoluteSource(true);
      } else if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
        if (absoluteEvent || event.absolute === true) {
          resolved = normalizeAngle(360 - event.alpha);
          setIsAbsoluteSource(true);
        } else if (!receivedReadingRef.current) {
          resolved = normalizeAngle(360 - event.alpha);
          setIsAbsoluteSource(false);
        }
      }

      if (resolved !== null) {
        receivedReadingRef.current = true;
        setSensorStatus('active');
        setHeading(resolved);
      }
    };

    const onAbs = (e: Event) => handleOrientation(e, true);
    const onRel = (e: Event) => handleOrientation(e, false);

    window.addEventListener('deviceorientationabsolute', onAbs, true);
    window.addEventListener('deviceorientation', onRel, true);

    const timeoutId = window.setTimeout(() => {
      if (!receivedReadingRef.current) {
        setSensorStatus('unavailable');
        setSensorMode('manual');
        setHeading(28);
      }
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('deviceorientationabsolute', onAbs, true);
      window.removeEventListener('deviceorientation', onRel, true);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      wasAlignedRef.current = false;
      return;
    }

    if (sensorMode === 'manual') {
      setSensorStatus('manual');
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensorStatus('unavailable');
      setSensorMode('manual');
      setHeading(28);
      return;
    }

    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationStaticWithPermission;
    if (typeof DOE?.requestPermission === 'function') {
      setSensorStatus('permission-required');
      return;
    }

    const cleanup = startListeners();
    return cleanup;
  }, [isOpen, sensorMode, startListeners]);

  const handleRequestIosPermission = async () => {
    try {
      const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationStaticWithPermission;
      if (typeof DOE?.requestPermission === 'function') {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          startListeners();
        } else {
          setSensorStatus('unavailable');
          setSensorMode('manual');
        }
      }
    } catch {
      setSensorStatus('unavailable');
      setSensorMode('manual');
    }
  };

  // Gentle audio & haptic cue on entering [354°..3°]
  useEffect(() => {
    if (!isOpen) return;
    if (isAligned && !wasAlignedRef.current) {
      if (soundEnabled) {
        playGentleAlignmentChime();
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([40, 30, 40]);
        } catch {
          // Ignore vibration restriction
        }
      }
    }
    wasAlignedRef.current = isAligned;
  }, [isAligned, isOpen, soundEnabled]);

  if (!isOpen) return null;

  // Build SVG degree ticks
  const ticks = Array.from({ length: 72 }, (_, idx) => {
    const angle = idx * 5;
    const isMajor = angle % 30 === 0;
    const isMedium = angle % 15 === 0 && !isMajor;
    const rOuter = 114;
    const rInner = isMajor ? 99 : isMedium ? 105 : 109;
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      angle,
      isMajor,
      x1: 140 + rInner * Math.cos(rad),
      y1: 140 + rInner * Math.sin(rad),
      x2: 140 + rOuter * Math.cos(rad),
      y2: 140 + rOuter * Math.sin(rad),
    };
  });

  const cardinalPoints = [
    { label: 'N', angle: 0, highlight: true },
    { label: 'NE', angle: 45, highlight: false },
    { label: 'L', angle: 90, highlight: false },
    { label: 'SE', angle: 135, highlight: false },
    { label: 'S', angle: 180, highlight: false },
    { label: 'SO', angle: 225, highlight: false },
    { label: 'O', angle: 270, highlight: false },
    { label: 'NO', angle: 315, highlight: false },
  ];

  // Arc coordinates for 354° to 3° (center 358.5°, covers 354..3 around North)
  const arcStartRad = ((354 - 90) * Math.PI) / 180;
  const arcEndRad = ((3 - 90) * Math.PI) / 180;
  const arcR = 118;
  const arcX1 = 140 + arcR * Math.cos(arcStartRad);
  const arcY1 = 140 + arcR * Math.sin(arcStartRad);
  const arcX2 = 140 + arcR * Math.cos(arcEndRad);
  const arcY2 = 140 + arcR * Math.sin(arcEndRad);

  // 357° marker dot on dial
  const target357Rad = ((357 - 90) * Math.PI) / 180;
  const target357X = 140 + 123 * Math.cos(target357Rad);
  const target357Y = 140 + 123 * Math.sin(target357Rad);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bússola de Alinhamento ao Norte Magnético 357 graus"
      className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full max-h-[94vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Compass className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Bússola de Alinhamento (Norte 357°)
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                {graphicTitle
                  ? `Alinhamento físico para a placa: ${graphicTitle}`
                  : 'Oriente o topo da placa radiônica (N ↑) entre 354° e 3°.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'Silenciar aviso sonoro' : 'Ativar aviso sonoro'}
              aria-label={soundEnabled ? 'Silenciar aviso sonoro' : 'Ativar aviso sonoro'}
              className="p-2 text-[#45464D] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#B45309]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar bússola"
              className="p-2 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Status / Mode Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 font-medium text-[#45464D]">
              {sensorStatus === 'active' ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>
                    Magnetômetro ativo ({isAbsoluteSource ? 'Norte absoluto' : 'Sensor relativo'})
                  </span>
                </>
              ) : sensorStatus === 'permission-required' ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Permissão de orientação necessária no iOS</span>
                </>
              ) : (
                <>
                  <Sliders className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>
                    {sensorStatus === 'unavailable'
                      ? 'Sem magnetômetro detectado · Modo Manual ativo'
                      : 'Modo Manual de Calibração'}
                  </span>
                </>
              )}
            </div>

            <div className="inline-flex items-center p-0.5 bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg">
              <button
                type="button"
                onClick={() => setSensorMode('auto')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors ${
                  sensorMode === 'auto'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Sensor
              </button>
              <button
                type="button"
                onClick={() => setSensorMode('manual')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors ${
                  sensorMode === 'manual'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {sensorStatus === 'permission-required' && sensorMode === 'auto' && (
            <div className="p-3.5 rounded-xl bg-[#FEFCE8] border border-[#D97706]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[#92400E]">
                Toque para liberar o acesso à bússola interna do iPhone/iPad.
              </p>
              <button
                type="button"
                onClick={handleRequestIosPermission}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer shrink-0"
              >
                Ativar Bússola iOS
              </button>
            </div>
          )}

          {/* Alignment Feedback Banner */}
          <div
            role="status"
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
              isAligned
                ? 'bg-[#F0FDF4] border-[#16A34A]/50 text-[#166534]'
                : 'bg-[#FAF8F5] border-[#E2E8F0] text-[#45464D]'
            }`}
          >
            {isAligned ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
            ) : (
              <Compass className="w-5 h-5 text-[#B45309] shrink-0" />
            )}
            <div className="text-xs leading-relaxed">
              {isAligned ? (
                <p className="font-bold text-[#166534]">
                  Alinhado ao Norte Magnético — Posicione o topo da placa
                </p>
              ) : (
                <p>
                  <strong className="text-[#0F172A]">Ajuste o azimute:</strong> gire{' '}
                  {deltaFrom357 > 0 ? `${deltaFrom357}° para a direita` : `${Math.abs(deltaFrom357)}° para a esquerda`}{' '}
                  até alcançar a faixa dourada (<span className="font-mono font-semibold">354°–3°</span>).
                </p>
              )}
            </div>
          </div>

          {/* Circular Compass Rose SVG */}
          <div className="flex flex-col items-center justify-center py-1">
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#B45309] mb-1">
              ▲ TOPO DA PLACA / APONTE AQUI ▲
            </p>
            <div className="relative w-[276px] h-[276px] flex items-center justify-center">
              <svg
                viewBox="0 0 280 280"
                className="w-full h-full overflow-visible select-none"
                aria-label={`Mostrador circular marcando ${normalizedHeading} graus`}
              >
                {/* Fixed outer ring */}
                <circle
                  cx="140"
                  cy="140"
                  r="130"
                  fill="#FAF8F5"
                  stroke={isAligned ? '#16A34A' : '#CBD5E1'}
                  strokeWidth={isAligned ? '3' : '2'}
                />

                {/* Fixed top device reference pointer */}
                <polygon
                  points="140,4 133,17 147,17"
                  fill={isAligned ? '#16A34A' : '#B45309'}
                />

                {/* Rotating Compass Rose */}
                <g
                  style={{
                    transform: `rotate(${-normalizedHeading}deg)`,
                    transformOrigin: '140px 140px',
                    transition: 'transform 140ms ease-out',
                  }}
                >
                  {/* Alignment gold band 354° - 3° */}
                  <path
                    d={`M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 0 1 ${arcX2} ${arcY2}`}
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />

                  {/* Exact 357° target marker */}
                  <circle cx={target357X} cy={target357Y} r="4.5" fill="#B45309" />

                  {/* Inner dial face */}
                  <circle
                    cx="140"
                    cy="140"
                    r="114"
                    fill="#FFFFFF"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />

                  {/* Degree ticks */}
                  {ticks.map((t) => (
                    <line
                      key={t.angle}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={t.angle === 0 ? '#B45309' : t.isMajor ? '#0F172A' : '#94A3B8'}
                      strokeWidth={t.angle === 0 ? '2.5' : t.isMajor ? '1.8' : '1'}
                    />
                  ))}

                  {/* Cardinal & intercardinal labels */}
                  {cardinalPoints.map((pt) => {
                    const rad = ((pt.angle - 90) * Math.PI) / 180;
                    const r = 82;
                    const x = 140 + r * Math.cos(rad);
                    const y = 140 + r * Math.sin(rad);
                    return (
                      <text
                        key={pt.label}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={pt.highlight ? '#B45309' : '#0F172A'}
                        fontSize={pt.highlight ? '16' : pt.label.length === 1 ? '13' : '10'}
                        fontWeight={pt.highlight ? '800' : '700'}
                        fontFamily="serif"
                      >
                        {pt.label}
                      </text>
                    );
                  })}

                  {/* North/South Needle inside rose */}
                  <polygon points="140,42 134,140 146,140" fill="#B45309" opacity="0.9" />
                  <polygon points="140,238 134,140 146,140" fill="#CBD5E1" opacity="0.85" />
                  <text
                    x="140"
                    y="124"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    357°
                  </text>
                </g>

                {/* Center Digital Hub */}
                <circle
                  cx="140"
                  cy="140"
                  r="34"
                  fill="#0F172A"
                  stroke={isAligned ? '#16A34A' : '#D97706'}
                  strokeWidth="2.5"
                />
                <text
                  x="140"
                  y="137"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="18"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {normalizedHeading}°
                </text>
                <text
                  x="140"
                  y="153"
                  textAnchor="middle"
                  fill={isAligned ? '#86EFAC' : '#FCD34D'}
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="sans-serif"
                >
                  {isAligned ? 'ALINHADO' : 'ALVO 357°'}
                </text>
              </svg>
            </div>
            <p className="mt-1 text-xs font-medium text-[#45464D]">
              Direção atual: <strong className="text-[#0F172A]">{getCardinalLabel(normalizedHeading)}</strong>
            </p>
          </div>

          {/* Manual Adjustment Fallback */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F172A]">
                Calibração / Simulação Manual (Desktop)
              </span>
              <span className="font-mono tabular-nums font-bold text-[#B45309]">
                {normalizedHeading}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              aria-label="Ajustar ângulo da bússola manualmente"
              value={normalizedHeading}
              onChange={(e) => {
                setSensorMode('manual');
                setHeading(Number(e.target.value));
              }}
              className="w-full clinical-slider"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Norte 357° (Alvo)', deg: 357 },
                { label: 'Norte 0°', deg: 0 },
                { label: 'Leste 90°', deg: 90 },
                { label: 'Sul 180°', deg: 180 },
                { label: 'Oeste 270°', deg: 270 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSensorMode('manual');
                    setHeading(preset.deg);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded border cursor-pointer transition-colors ${
                    normalizedHeading === preset.deg
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-[#45464D] border-[#CBD5E1] hover:border-[#B45309]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

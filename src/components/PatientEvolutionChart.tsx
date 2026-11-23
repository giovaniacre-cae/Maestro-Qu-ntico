import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ClinicalSessionRecord } from '../types/clinical';
import { getHawkinsLevelInfo } from '../utils/antiCatharsis';

interface PatientEvolutionChartProps {
  sessions: ClinicalSessionRecord[];
}

function getPerceptionScore(rec: ClinicalSessionRecord): number | undefined {
  const raw =
    rec.clientPerceptionScore ?? rec.ansaeRhen?.spiritualPsycho?.clientPerceptionScore;
  return typeof raw === 'number' && !Number.isNaN(raw)
    ? Math.max(0, Math.min(10, raw))
    : undefined;
}

function getPerceptionNote(rec: ClinicalSessionRecord): string | undefined {
  return rec.clientPerceptionNote ?? rec.ansaeRhen?.spiritualPsycho?.clientPerceptionNote;
}

function getPerceptionMoment(rec: ClinicalSessionRecord): 'antes' | 'pos' | undefined {
  return rec.clientPerceptionMoment ?? rec.ansaeRhen?.spiritualPsycho?.clientPerceptionMoment;
}

function buildSvgPolylinePath(points: Array<{ x: number; y: number } | null>): string {
  let path = '';
  let started = false;
  for (const pt of points) {
    if (!pt) {
      started = false;
      continue;
    }
    path += `${started ? 'L' : 'M'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
    started = true;
  }
  return path.trim();
}

export const PatientEvolutionChart: React.FC<PatientEvolutionChartProps> = ({ sessions }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    Math.max(0, sessions.length - 1)
  );

  if (sessions.length === 0) return null;

  const safeIndex = Math.min(selectedIndex, sessions.length - 1);
  const selectedRec = sessions[safeIndex];

  // Responsive SVG coordinate system
  const width = 680;
  const height = 220;
  const padLeft = 46;
  const padRight = 28;
  const padTop = 22;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (idx: number): number => {
    if (sessions.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (sessions.length - 1)) * plotW;
  };

  const pctToY = (pct: number): number => {
    const clamped = Math.max(0, Math.min(100, pct));
    return padTop + plotH - (clamped / 100) * plotH;
  };

  const bovisPoints = sessions.map((rec, i) => {
    const bovis = rec.ansaeRhen.spiritualPsycho.bovis ?? 0;
    return {
      x: getX(i),
      y: pctToY((Math.min(18000, Math.max(0, bovis)) / 18000) * 100),
      val: bovis,
    };
  });

  const hawkinsPoints = sessions.map((rec, i) => {
    const hz = rec.ansaeRhen.spiritualPsycho.hawkinsAgathaHz ?? 200;
    return {
      x: getX(i),
      y: pctToY((Math.min(1000, Math.max(0, hz)) / 1000) * 100),
      val: hz,
    };
  });

  const perceptionPoints = sessions.map((rec, i) => {
    const score = getPerceptionScore(rec);
    if (typeof score !== 'number') return null;
    return {
      x: getX(i),
      y: pctToY((score / 10) * 100),
      val: score,
    };
  });

  const stressPoints = sessions.map((rec, i) => {
    const stress = rec.ansaeRhen.spiritualPsycho.stressLevel ?? 0;
    return {
      x: getX(i),
      y: pctToY((Math.min(9, Math.max(0, stress)) / 9) * 100),
      val: stress,
    };
  });

  const bovisThresholdY = pctToY((6500 / 18000) * 100);
  const selectedPerception = getPerceptionScore(selectedRec);
  const selectedPerceptionMoment = getPerceptionMoment(selectedRec);
  const selectedPerceptionNote = getPerceptionNote(selectedRec);
  const selectedHawkins = getHawkinsLevelInfo(
    selectedRec.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
  );

  return (
    <div className="px-6 py-5 bg-white border-b border-[#E2E8F0] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#B45309]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            Linha do Tempo Evolutiva Visual (Bovis · Hawkins · Percepção 0–10 · Estresse)
          </h3>
        </div>
        {sessions.length === 1 && (
          <span className="text-[11px] text-[#64748B]">
            Ponto inicial registrado · Reavalie após o ciclo para traçar a curva evolutiva
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#45464D]">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-0.5 bg-[#B45309] inline-block" />
          Bovis (0–18.000 Å)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-0.5 bg-[#0F172A] inline-block" />
          Hawkins (20–1000 Hz)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 h-0.5 bg-[#16A34A] inline-block" />
          Percepção do Consulente (0–10)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="w-3 border-t-2 border-dashed border-[#DC2626] inline-block" />
          Estresse Neural (0–9)
        </span>
      </div>

      {/* Responsive SVG Chart */}
      <div className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAF8F5] p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[250px] overflow-visible select-none"
          role="img"
          aria-label="Gráfico comparativo evolutivo entre sessões de Bovis, Hawkins, Percepção e Estresse"
        >
          {/* Horizontal gridlines (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = pctToY(pct);
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill="#94A3B8"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Bovis 6.500 Å reference line */}
          <line
            x1={padLeft}
            y1={bovisThresholdY}
            x2={width - padRight}
            y2={bovisThresholdY}
            stroke="#D97706"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.7"
          />
          <text
            x={width - padRight}
            y={bovisThresholdY - 5}
            textAnchor="end"
            fill="#B45309"
            fontSize="8.5"
            fontFamily="monospace"
          >
            Limiar 6.500 Å
          </text>

          {/* Selected vertical milestone column */}
          <line
            x1={getX(safeIndex)}
            y1={padTop}
            x2={getX(safeIndex)}
            y2={padTop + plotH}
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />

          {/* Polylines */}
          {sessions.length > 1 && (
            <>
              <path
                d={buildSvgPolylinePath(bovisPoints)}
                fill="none"
                stroke="#B45309"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={buildSvgPolylinePath(hawkinsPoints)}
                fill="none"
                stroke="#0F172A"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={buildSvgPolylinePath(perceptionPoints)}
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={buildSvgPolylinePath(stressPoints)}
                fill="none"
                stroke="#DC2626"
                strokeWidth="1.8"
                strokeDasharray="5 4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Nodes + X-axis clickable columns */}
          {sessions.map((rec, idx) => {
            const cx = getX(idx);
            const isSelected = idx === safeIndex;
            const bovisPt = bovisPoints[idx];
            const hawkinsPt = hawkinsPoints[idx];
            const perceptionPt = perceptionPoints[idx];
            const stressPt = stressPoints[idx];
            const dateLabel = new Date(rec.activatedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            });

            return (
              <g
                key={rec.id}
                onClick={() => setSelectedIndex(idx)}
                className="cursor-pointer"
              >
                {/* Invisible hit column for easy tap/click */}
                <rect
                  x={cx - 28}
                  y={padTop}
                  width={56}
                  height={plotH + 34}
                  fill="transparent"
                />

                {/* Stress point */}
                <circle
                  cx={stressPt.x}
                  cy={stressPt.y}
                  r={isSelected ? 4.5 : 3.2}
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Hawkins point */}
                <circle
                  cx={hawkinsPt.x}
                  cy={hawkinsPt.y}
                  r={isSelected ? 5 : 3.5}
                  fill="#0F172A"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Bovis point */}
                <circle
                  cx={bovisPt.x}
                  cy={bovisPt.y}
                  r={isSelected ? 5.5 : 4}
                  fill="#B45309"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Perception point */}
                {perceptionPt && (
                  <circle
                    cx={perceptionPt.x}
                    cy={perceptionPt.y}
                    r={isSelected ? 5.5 : 4}
                    fill="#16A34A"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                )}

                {/* X-axis label */}
                <text
                  x={cx}
                  y={height - 20}
                  textAnchor="middle"
                  fill={isSelected ? '#0F172A' : '#64748B'}
                  fontSize="10"
                  fontWeight={isSelected ? '700' : '500'}
                  fontFamily="sans-serif"
                >
                  {rec.sessionType}
                </text>
                <text
                  x={cx}
                  y={height - 7}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {dateLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Milestone Readout Strip */}
      <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#0F172A]">{selectedRec.sessionType}</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">
              ·
            </span>
            <span className="font-mono text-[#64748B]">
              {new Date(selectedRec.activatedAt).toLocaleDateString('pt-BR')}
            </span>
            {sessions.length > 1 && (
              <span className="text-[11px] text-[#B45309] font-medium">
                (Clique nos marcos do gráfico para comparar)
              </span>
            )}
          </div>
          {selectedRec.withdrawnEmissions && selectedRec.withdrawnEmissions.length > 0 && (
            <span className="text-[11px] font-mono font-semibold text-[#166534]">
              {selectedRec.withdrawnEmissions.length} placa(s) concluída(s)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-md px-3 py-2">
            <span className="block text-[10px] text-[#64748B]">Biômetro Bovis</span>
            <span className="font-mono tabular-nums font-bold text-[#B45309]">
              {selectedRec.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å
            </span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-md px-3 py-2">
            <span className="block text-[10px] text-[#64748B]">Hawkins / Ágatha</span>
            <span className="font-mono tabular-nums font-bold text-[#0F172A]">
              {selectedHawkins.fullLabel}
            </span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-md px-3 py-2">
            <span className="block text-[10px] text-[#64748B]">
              Percepção ({selectedPerceptionMoment === 'pos' ? 'Pós-Ciclo' : 'Antes'})
            </span>
            <span className="font-mono tabular-nums font-bold text-[#16A34A]">
              {typeof selectedPerception === 'number'
                ? `${selectedPerception} / 10`
                : 'Não registrada'}
            </span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-md px-3 py-2">
            <span className="block text-[10px] text-[#64748B]">Estresse Neural</span>
            <span className="font-mono tabular-nums font-bold text-[#DC2626]">
              {selectedRec.ansaeRhen.spiritualPsycho.stressLevel} / 9
            </span>
          </div>
        </div>

        {selectedPerceptionNote && selectedPerceptionNote.trim() !== '' && (
          <p className="text-xs text-[#45464D] italic pt-0.5">
            &ldquo;{selectedPerceptionNote}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
};

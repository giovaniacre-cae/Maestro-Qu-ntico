import React from 'react';
import { ScreenId } from '../types/quantum';

interface TopNavProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onNewConsultation: () => void;
}

const NAV_ITEMS: Array<{ id: ScreenId; label: string }> = [
  { id: 'dashboard', label: 'Salas Ativas' },
  { id: 'anamnesis', label: 'Anamnese' },
  { id: 'sensitivity', label: 'Sintonia' },
  { id: 'quantum-table', label: 'Mesa Radiônica' },
  { id: 'documents', label: 'Documentos' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeScreen,
  onNavigate,
  onNewConsultation,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E2E8F0]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo + Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 font-serif text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] rounded cursor-pointer"
        >
          <img
            src="./assets/aistudio/Logo_Maestro_terapias_Vibracionais_Sem_fundo__2__f6ac1f97.png"
            alt="Logo Maestro Terapias Vibracionais"
            referrerPolicy="no-referrer"
            className="w-10 h-10 object-contain shrink-0"
          />
          <span>Maestro Quântico</span>
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Navegação Clínica"
          className="hidden lg:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] rounded cursor-pointer ${
                  isActive
                    ? 'text-[#0F172A] font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#B45309]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewConsultation}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] rounded-lg border border-white/10 hover:shadow-[0_0_16px_rgba(217,119,6,0.25)] hover:bg-[#1E293B] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
          >
            + Novo Atendimento Quântico
          </button>
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <nav
        aria-label="Navegação Mobile"
        className="lg:hidden flex items-center gap-5 px-4 py-2 border-t border-[#E2E8F0] overflow-x-auto text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-[#B45309] text-[#0F172A] font-semibold'
                  : 'border-transparent text-[#64748B]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

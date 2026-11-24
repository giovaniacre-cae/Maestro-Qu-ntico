import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ImageUp,
  Palette,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_CLINIC_LOGO_URL,
  DEFAULT_PROFESSIONAL_PROFILE,
  ProfessionalProfile,
  getProfessionalProfile,
  resetProfessionalProfile,
  saveProfessionalProfile,
} from '../utils/storage';

interface ProfessionalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PalettePreset {
  id: string;
  label: string;
  description: string;
  primaryColor: string;
  accentColor: string;
}

const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'maestro-classic',
    label: 'Maestro Clássico',
    description: 'Azul-Marinho & Dourado',
    primaryColor: '#0F172A',
    accentColor: '#B45309',
  },
  {
    id: 'emerald-gold',
    label: 'Esmeralda & Ouro',
    description: 'Verde Esmeralda & Ouro',
    primaryColor: '#064E3B',
    accentColor: '#B45309',
  },
  {
    id: 'indigo-silver',
    label: 'Índigo & Prata',
    description: 'Índigo Profundo & Prata',
    primaryColor: '#1E1B4B',
    accentColor: '#64748B',
  },
  {
    id: 'burgundy-bronze',
    label: 'Bordô & Bronze',
    description: 'Bordô Clínico & Bronze',
    primaryColor: '#4C0519',
    accentColor: '#B45309',
  },
];

async function resizeLogoFileToPngDataUrl(file: File): Promise<string> {
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Selecione uma imagem PNG, JPG ou WEBP.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o arquivo de imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao carregar a imagem selecionada.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Arquivo de imagem inválido ou corrompido.'));
    image.src = rawDataUrl;
  });

  const maxSide = 320;
  const srcW = img.naturalWidth || img.width || maxSide;
  const srcH = img.naturalHeight || img.height || maxSide;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem no navegador.');
  }
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL('image/png');
}

export const ProfessionalProfileModal: React.FC<ProfessionalProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [form, setForm] = useState<ProfessionalProfile>(() => getProfessionalProfile());
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(getProfessionalProfile());
    setConfirmingReset(false);
    setFeedback(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeLogoSrc = form.logoDataUrl || DEFAULT_CLINIC_LOGO_URL;

  const handleFieldChange = (
    field: keyof ProfessionalProfile,
    value: string | null
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
    setConfirmingReset(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoProcessing(true);
    setFeedback(null);
    try {
      const resizedPng = await resizeLogoFileToPngDataUrl(file);
      setForm((prev) => ({ ...prev, logoDataUrl: resizedPng }));
      setFeedback({
        type: 'success',
        text: 'Logomarca ajustada e pronta para aplicação nos relatórios e cabeçalho.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível processar a imagem selecionada.',
      });
    } finally {
      setLogoProcessing(false);
      e.target.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = saveProfessionalProfile(form);
      setForm(saved);
      onClose();
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível salvar a identidade da clínica.',
      });
    }
  };

  const handleConfirmReset = () => {
    const restored = resetProfessionalProfile();
    setForm(restored);
    setConfirmingReset(false);
    setFeedback({
      type: 'success',
      text: 'Padrão original Maestro restaurado.',
    });
  };

  const metadataLine = [
    form.subtitleLine.trim(),
    form.contacts.trim() ? `Contatos: ${form.contacts.trim()}` : '',
    form.emailOrSocial.trim(),
    (form.website || '').trim(),
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0F172A]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="professional-profile-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col bg-[#FAF8F5] border border-[#CBD5E1] rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 py-4 bg-white border-b border-[#E2E8F0]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h2
                id="professional-profile-title"
                className="font-serif text-lg sm:text-xl font-bold text-[#0F172A]"
              >
                Minha Clínica / Perfil Profissional (White-Label)
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Personalize o logotipo, credenciais, contatos e paleta institucional aplicados no
                cabeçalho, prévia documental, DOCX, PDF e WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações da clínica"
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-[#FAF8F5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6">
          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                feedback.type === 'success'
                  ? 'bg-[#DCFCE7]/70 border-[#16A34A]/40 text-[#166534]'
                  : 'bg-[#FEF2F2] border-[#BA1A1A]/40 text-[#93000A]'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Prévia ao Vivo do Cabeçalho Oficial */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Prévia em Tempo Real do Cabeçalho Oficial (PDF / DOCX / Central Documental)
              </span>
              <span className="text-[11px] text-[#64748B]">Logo centralizada 68px</span>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-7 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.05)]">
              <div
                className="text-center space-y-1 pb-5"
                style={{ borderBottom: `2px solid ${form.accentColor}` }}
              >
                <img
                  src={activeLogoSrc}
                  alt={`Logotipo ${form.clinicName || 'da clínica'}`}
                  referrerPolicy="no-referrer"
                  className="w-[68px] h-[68px] mx-auto object-contain mb-2"
                />
                <h3
                  className="font-serif text-lg sm:text-xl font-bold tracking-wide uppercase"
                  style={{ color: form.primaryColor }}
                >
                  {form.clinicName.trim() || DEFAULT_PROFESSIONAL_PROFILE.clinicName}
                </h3>
                <p
                  className="font-serif italic text-sm font-semibold"
                  style={{ color: form.accentColor }}
                >
                  Relatório Técnico Completo — ANSAE + RHEN &amp; Protocolo Vibracional
                </p>
                <p className="text-xs sm:text-sm pt-1" style={{ color: form.primaryColor }}>
                  <strong>
                    {form.therapistName.trim() || DEFAULT_PROFESSIONAL_PROFILE.therapistName}
                  </strong>
                  {form.credentials.trim() ? (
                    <span className="text-[#334155] font-normal">
                      {' '}
                      | {form.credentials.trim()}
                    </span>
                  ) : null}
                </p>
                {metadataLine && (
                  <p className="text-xs text-[#64748B]">{metadataLine}</p>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Dados da Clínica & Terapeuta */}
            <section className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
              <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2">
                Dados Institucionais &amp; Terapeuta
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Nome da Clínica / Espaço Terapêutico *
                  </span>
                  <input
                    type="text"
                    required
                    value={form.clinicName}
                    onChange={(e) => handleFieldChange('clinicName', e.target.value)}
                    placeholder="Ex.: Espaço Luz & Harmonia"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Nome do Terapeuta *
                  </span>
                  <input
                    type="text"
                    required
                    value={form.therapistName}
                    onChange={(e) => handleFieldChange('therapistName', e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Subtítulo Institucional
                  </span>
                  <input
                    type="text"
                    value={form.subtitleLine}
                    onChange={(e) => handleFieldChange('subtitleLine', e.target.value)}
                    placeholder="Ex.: Consultoria Holística Integrativa"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Credenciais &amp; Especialidades
                  </span>
                  <input
                    type="text"
                    value={form.credentials}
                    onChange={(e) => handleFieldChange('credentials', e.target.value)}
                    placeholder="Ex.: Terapeuta Vibracional • Radiestesista • CRTH / ABRATH"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Contatos (WhatsApp / Telefone)
                  </span>
                  <input
                    type="text"
                    value={form.contacts}
                    onChange={(e) => handleFieldChange('contacts', e.target.value)}
                    placeholder="(00) 90000-0000"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    E-mail, Instagram ou Registro (opcional)
                  </span>
                  <input
                    type="text"
                    value={form.emailOrSocial}
                    onChange={(e) => handleFieldChange('emailOrSocial', e.target.value)}
                    placeholder="@clinica • ABRATH 0000 • email@..."
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>

                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Website (opcional)
                  </span>
                  <input
                    type="text"
                    inputMode="url"
                    value={form.website || ''}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="Ex.: https://www.suaclinica.com.br"
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </label>
              </div>
            </section>

            {/* Logomarca & Paleta de Cores */}
            <section className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-5">
              {/* Upload Logo */}
              <div className="space-y-3">
                <h3 className="font-serif text-sm font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2">
                  Logomarca Oficial
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-[72px] h-[72px] rounded-xl border border-[#E2E8F0] bg-[#FAF8F5] flex items-center justify-center p-1.5 shrink-0">
                    <img
                      src={activeLogoSrc}
                      alt="Logomarca atual"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={logoProcessing}
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <ImageUp className="w-3.5 h-3.5 text-[#B45309]" />
                      {logoProcessing
                        ? 'Otimizando imagem...'
                        : 'Enviar Logomarca (PNG/JPG/WEBP)'}
                    </button>
                    {form.logoDataUrl ? (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('logoDataUrl', null)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#93000A] bg-[#FEF2F2] border border-[#BA1A1A]/30 rounded-lg hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover logo personalizada (usar padrão)
                      </button>
                    ) : (
                      <p className="text-[11px] text-[#64748B]">
                        Usando logomarca padrão embutida. Imagens enviadas são otimizadas para
                        PNG 320px.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Paleta Institucional */}
              <div className="space-y-3 pt-1 border-t border-[#E2E8F0]">
                <div className="flex items-center gap-1.5 pt-1">
                  <Palette className="w-4 h-4 text-[#B45309]" />
                  <h3 className="font-serif text-sm font-bold text-[#0F172A]">
                    Paleta Institucional dos Documentos
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PALETTE_PRESETS.map((preset) => {
                    const isSelected =
                      form.primaryColor.toUpperCase() === preset.primaryColor &&
                      form.accentColor.toUpperCase() === preset.accentColor;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            primaryColor: preset.primaryColor,
                            accentColor: preset.accentColor,
                          }));
                          setFeedback(null);
                        }}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#B45309] bg-[#FAF8F5]'
                            : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.primaryColor }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/10"
                              style={{ backgroundColor: preset.accentColor }}
                            />
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#B45309]" />}
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-[#0F172A] leading-tight">
                          {preset.label}
                        </p>
                        <p className="text-[10px] text-[#64748B] leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-[#0F172A]">
                      Cor Primária (Títulos)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primaryColor}
                        onChange={(e) =>
                          handleFieldChange('primaryColor', e.target.value.toUpperCase())
                        }
                        className="w-9 h-9 p-0.5 rounded border border-[#CBD5E1] bg-white cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#334155] uppercase">
                        {form.primaryColor}
                      </span>
                    </div>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-[#0F172A]">
                      Cor de Destaque (Subtítulo &amp; Linha)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.accentColor}
                        onChange={(e) =>
                          handleFieldChange('accentColor', e.target.value.toUpperCase())
                        }
                        className="w-9 h-9 p-0.5 rounded border border-[#CBD5E1] bg-white cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#334155] uppercase">
                        {form.accentColor}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </section>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#E2E8F0]">
            <div>
              {!confirmingReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-white border border-transparent hover:border-[#E2E8F0] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão Original
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#93000A] font-medium">
                    Restaurar dados padrão Maestro?
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-[#BA1A1A] rounded-md hover:bg-[#93000A] cursor-pointer"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="px-2.5 py-1 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:text-[#0F172A] cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-lg hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#F59E0B]" />
                Salvar Identidade da Clínica
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

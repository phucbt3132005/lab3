import React from 'react';
import { Thermometer, Gauge, Mountain, TrendingUp, TrendingDown } from 'lucide-react';
import { SensorData } from '../types';

interface SensorCardsProps {
  data: SensorData | null;
}

interface CardConfig {
  label: string;
  unit: string;
  icon: React.ElementType;
  iconColor: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  getValue: (d: SensorData) => number;
  getStatusLabel: (d: SensorData) => { text: string; color: string };
  format: (v: number) => string;
}

const cards: CardConfig[] = [
  {
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
    iconColor: 'text-orange-400',
    gradientFrom: 'from-orange-500/20',
    gradientTo: 'to-red-500/10',
    glowColor: 'shadow-orange-500/20',
    getValue: d => d.temperature,
    getStatusLabel: d => {
      if (d.temperature > 38) return { text: 'HIGH – Nhiệt độ cao', color: 'text-red-400' };
      if (d.temperature < 10) return { text: 'LOW – Nhiệt độ thấp', color: 'text-blue-400' };
      return { text: 'NORMAL – Bình thường', color: 'text-emerald-400' };
    },
    format: v => v.toFixed(1),
  },
  {
    label: 'Air Pressure',
    unit: 'hPa',
    icon: Gauge,
    iconColor: 'text-purple-400',
    gradientFrom: 'from-purple-500/20',
    gradientTo: 'to-blue-500/10',
    glowColor: 'shadow-purple-500/20',
    getValue: d => d.pressure,
    getStatusLabel: d => {
      if (d.pressure > 1013) return { text: 'HIGH – Áp suất cao', color: 'text-blue-300' };
      if (d.pressure < 980)  return { text: 'LOW – Áp suất thấp', color: 'text-yellow-400' };
      return { text: 'NORMAL – Tiêu chuẩn', color: 'text-emerald-400' };
    },
    format: v => v.toFixed(1),
  },
  {
    label: 'Altitude',
    unit: 'm',
    icon: Mountain,
    iconColor: 'text-cyan-400',
    gradientFrom: 'from-cyan-500/20',
    gradientTo: 'to-teal-500/10',
    glowColor: 'shadow-cyan-500/20',
    getValue: d => d.altitude,
    getStatusLabel: () => ({ text: 'vs Sea Level (101325 Pa)', color: 'text-slate-400' }),
    format: v => v.toFixed(1),
  },
];

const SensorCards: React.FC<SensorCardsProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = data ? card.getValue(data) : null;
        const status = data ? card.getStatusLabel(data) : null;

        return (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br ${card.gradientFrom} ${card.gradientTo} bg-navy-800 shadow-xl ${card.glowColor} p-5 transition-all duration-300 hover:scale-[1.02] hover:border-white/15`}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-2 right-2 w-24 h-24 rounded-full border-4 border-white/20" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full border-4 border-white/10" />
            </div>

            <div className="relative">
              {/* Icon & Label */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">{card.label}</p>
                </div>
                <div className={`p-2 rounded-xl bg-white/5 border border-white/8 ${card.iconColor}`}>
                  <Icon size={18} />
                </div>
              </div>

              {/* Value */}
              <div className="mb-3">
                {value !== null ? (
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-white tabular-nums leading-none">
                      {card.format(value)}
                    </span>
                    <span className="text-lg text-slate-300 mb-1 font-medium">{card.unit}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-slate-500">—</span>
                    <span className="text-lg text-slate-600">{card.unit}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className={`text-xs font-medium ${status ? status.color : 'text-slate-500'}`}>
                {status ? status.text : 'Chưa có dữ liệu'}
              </div>

              {/* Trend indicator (nếu có dữ liệu) */}
              {value !== null && card.label === 'Temperature' && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  {value > 25 ? <TrendingUp size={12} className="text-orange-400" /> : <TrendingDown size={12} className="text-blue-400" />}
                  <span>Môi trường chạy bộ</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SensorCards;

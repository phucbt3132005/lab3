import React from 'react';
import { AlertState, AlertType } from '../types';
import { CheckCircle, AlertTriangle, Flame, Snowflake, MountainSnow, DatabaseZap } from 'lucide-react';

interface AlertPanelProps {
  alertState: AlertState;
}

const alertConfigs: Record<AlertType, {
  Icon:        React.ElementType;
  iconColor:   string;
  bg:          string;
  border:      string;
  title:       string;
  titleColor:  string;
  glow:        string;
}> = {
  normal: {
    Icon:        CheckCircle,
    iconColor:   'text-emerald-400',
    bg:          'bg-emerald-500/8',
    border:      'border-emerald-500/25',
    title:       'NORMAL',
    titleColor:  'text-emerald-400',
    glow:        'shadow-emerald-500/10',
  },
  high_temp: {
    Icon:        Flame,
    iconColor:   'text-red-400',
    bg:          'bg-red-500/10',
    border:      'border-red-500/35',
    title:       'HIGH TEMPERATURE',
    titleColor:  'text-red-400',
    glow:        'shadow-red-500/20',
  },
  low_temp: {
    Icon:        Snowflake,
    iconColor:   'text-blue-400',
    bg:          'bg-blue-500/10',
    border:      'border-blue-500/35',
    title:       'LOW TEMPERATURE',
    titleColor:  'text-blue-400',
    glow:        'shadow-blue-500/20',
  },
  altitude_change: {
    Icon:        MountainSnow,
    iconColor:   'text-amber-400',
    bg:          'bg-amber-500/10',
    border:      'border-amber-500/35',
    title:       'SUDDEN ALTITUDE CHANGE',
    titleColor:  'text-amber-400',
    glow:        'shadow-amber-500/20',
  },
  no_data: {
    Icon:        DatabaseZap,
    iconColor:   'text-slate-400',
    bg:          'bg-slate-500/8',
    border:      'border-slate-500/20',
    title:       'NO DATA',
    titleColor:  'text-slate-400',
    glow:        '',
  },
};

const AlertPanel: React.FC<AlertPanelProps> = ({ alertState }) => {
  const cfg = alertConfigs[alertState.type];
  const Icon = cfg.Icon;
  const isAlert = alertState.type !== 'normal' && alertState.type !== 'no_data';

  return (
    <div className="rounded-2xl border border-white/8 bg-navy-800/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Alert Status</h2>
          <p className="text-xs text-slate-500 mt-0.5">Trạng thái cảnh báo hệ thống từ ESP32</p>
        </div>
        {isAlert && (
          <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-1 rounded-full animate-pulse">
            ALERT
          </span>
        )}
      </div>

      <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 shadow-lg ${cfg.bg} ${cfg.border} ${cfg.glow}`}>
        <div className={`mt-0.5 p-2 rounded-lg bg-white/5 ${cfg.iconColor} ${isAlert ? 'animate-pulse' : ''}`}>
          <Icon size={22} />
        </div>
        <div className="flex-1">
          <div className={`text-sm font-bold tracking-wide ${cfg.titleColor}`}>
            {cfg.title}
          </div>
          <div className="text-xs text-slate-400 mt-1 leading-relaxed">
            {alertState.message}
          </div>
        </div>
      </div>

      {/* Ngưỡng cảnh báo */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {[
          { label: 'Nhiệt độ cao',   value: '> 38°C',  color: 'text-red-400',   dot: 'bg-red-400' },
          { label: 'Nhiệt độ thấp',  value: '< 10°C',  color: 'text-blue-400',  dot: 'bg-blue-400' },
          { label: 'Độ cao đột ngột', value: '≥ 15 m',  color: 'text-amber-400', dot: 'bg-amber-400' },
        ].map(item => (
          <div key={item.label} className="flex flex-col gap-0.5 bg-white/3 rounded-lg p-2 border border-white/5">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
              <span className="text-slate-500 leading-tight">{item.label}</span>
            </div>
            <span className={`font-semibold ${item.color} pl-3`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertPanel;

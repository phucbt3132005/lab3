import React from 'react';
import { Lightbulb, Bell, Power, PowerOff } from 'lucide-react';
import { ActuatorState } from '../types';

interface ControlPanelProps {
  actuator:   ActuatorState;
  setLed:     (on: boolean) => void;
  setBuzzer:  (on: boolean) => void;
}

interface ControlCardProps {
  title:       string;
  description: string;
  isOn:        boolean;
  manualOn:    boolean;
  Icon:        React.ElementType;
  onTurnOn:    () => void;
  onTurnOff:   () => void;
  variant:     'led' | 'buzzer';
}

const variantStyles = {
  led: {
    border:      'border-yellow-500/40',
    bg:          'bg-yellow-500/8',
    shadow:      'shadow-yellow-500/10',
    iconOn:      'bg-yellow-500/20 text-yellow-400',
    dot:         'bg-yellow-400',
    badge:       'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
    dotStatus:   'bg-yellow-400',
    dotStatusOn: 'text-yellow-400',
    btnOnBg:     'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50',
    btnOnActive: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 cursor-default',
    warningText: 'text-amber-400/80 bg-amber-400/8 border-amber-400/15',
  },
  buzzer: {
    border:      'border-purple-500/40',
    bg:          'bg-purple-500/8',
    shadow:      'shadow-purple-500/10',
    iconOn:      'bg-purple-500/20 text-purple-400',
    dot:         'bg-purple-400',
    badge:       'bg-purple-500/15 border-purple-500/30 text-purple-400',
    dotStatus:   'bg-purple-400',
    dotStatusOn: 'text-purple-400',
    btnOnBg:     'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50',
    btnOnActive: 'bg-purple-500/20 border-purple-500/40 text-purple-300 cursor-default',
    warningText: 'text-amber-400/80 bg-amber-400/8 border-amber-400/15',
  },
} as const;

const ControlCard: React.FC<ControlCardProps> = ({
  title, description, isOn, manualOn, Icon, onTurnOn, onTurnOff, variant,
}) => {
  const s = variantStyles[variant];

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${
      isOn
        ? `${s.border} ${s.bg} shadow-lg ${s.shadow}`
        : 'border-white/8 bg-navy-800/60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`relative p-2.5 rounded-xl transition-all duration-300 ${
            isOn ? s.iconOn : 'bg-white/5 text-slate-500'
          }`}>
            <Icon size={20} />
            {isOn && (
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${s.dot} animate-pulse border-2 border-navy-900`} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>

        {/* State Badge */}
        <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
          isOn
            ? s.badge
            : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
        }`}>
          {isOn ? 'ON' : 'OFF'}
        </div>
      </div>

      {/* Manual State indicator */}
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <span className={`w-2 h-2 rounded-full ${manualOn ? s.dotStatus : 'bg-slate-600'}`} />
        Manual:{' '}
        <span className={manualOn ? `${s.dotStatusOn} font-medium` : ''}>
          {manualOn ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onTurnOn}
          disabled={manualOn}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border active:scale-95 ${
            manualOn ? s.btnOnActive : s.btnOnBg
          }`}
        >
          <Power size={14} />
          Bật
        </button>
        <button
          onClick={onTurnOff}
          disabled={!manualOn}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border active:scale-95 ${
            !manualOn
              ? 'bg-white/3 border-white/8 text-slate-600 cursor-default'
              : 'bg-slate-500/10 border-slate-500/30 text-slate-300 hover:bg-slate-500/20 hover:border-slate-500/40'
          }`}
        >
          <PowerOff size={14} />
          Tắt
        </button>
      </div>

      {/* Warning when auto alert is overriding */}
      {isOn && !manualOn && (
        <p className={`mt-3 text-xs rounded-lg px-3 py-2 border ${s.warningText}`}>
          ⚡ Đang bật do cảnh báo tự động. Không thể tắt thủ công.
        </p>
      )}
    </div>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({ actuator, setLed, setBuzzer }) => {
  return (
    <div className="rounded-2xl border border-white/8 bg-navy-800/40 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Manual Control</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Điều khiển thủ công từ Dashboard. Cảnh báo tự động sẽ ghi đè lệnh tắt.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ControlCard
          title="LED Control"
          description="GPIO 26 – Điều khiển đèn LED"
          isOn={actuator.ledOn}
          manualOn={actuator.manualLed}
          Icon={Lightbulb}
          variant="led"
          onTurnOn={() => setLed(true)}
          onTurnOff={() => setLed(false)}
        />
        <ControlCard
          title="Buzzer Control"
          description="GPIO 27 – Điều khiển còi báo"
          isOn={actuator.buzzerOn}
          manualOn={actuator.manualBuzzer}
          Icon={Bell}
          variant="buzzer"
          onTurnOn={() => setBuzzer(true)}
          onTurnOff={() => setBuzzer(false)}
        />
      </div>
    </div>
  );
};

export default ControlPanel;

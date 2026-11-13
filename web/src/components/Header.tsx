import React from 'react';
import { MqttStatus } from '../types';
import { Activity, Wifi, WifiOff, AlertCircle, Loader2, Clock } from 'lucide-react';

interface HeaderProps {
  mqttStatus: MqttStatus;
  deviceOnline: boolean;
  lastUpdate: number | null;
}

const StatusBadge: React.FC<{ status: MqttStatus }> = ({ status }) => {
  const configs = {
    connected:    { icon: Wifi,         color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', label: 'MQTT Connected' },
    connecting:   { icon: Loader2,      color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30',  label: 'Connecting...' },
    disconnected: { icon: WifiOff,      color: 'text-slate-400',   bg: 'bg-slate-400/10 border-slate-400/30',   label: 'Disconnected' },
    error:        { icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30',       label: 'MQTT Error' },
  };
  const cfg = configs[status];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon size={13} className={status === 'connecting' ? 'animate-spin' : ''} />
      {cfg.label}
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ mqttStatus, deviceOnline, lastUpdate }) => {
  const formatTime = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('vi-VN');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-md bg-navy-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Activity size={20} className="text-white" />
              </div>
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-navy-900 ${deviceOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide leading-tight">
                RUNNER <span className="text-cyan-400">MONITORING</span>
              </h1>
              <p className="text-xs text-slate-400 tracking-widest uppercase">System Dashboard</p>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={mqttStatus} />

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
              deviceOnline
                ? 'bg-blue-400/10 border-blue-400/30 text-blue-400'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${deviceOnline ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
              {deviceOnline ? 'ESP32 Online' : 'ESP32 Offline'}
            </div>

            {lastUpdate && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-400">
                <Clock size={12} />
                {formatTime(lastUpdate)}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

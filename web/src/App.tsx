import React from 'react';
import { useMqtt } from './hooks/useMqtt';
import Header from './components/Header';
import SensorCards from './components/SensorCards';
import Charts from './components/Charts';
import ControlPanel from './components/ControlPanel';
import AlertPanel from './components/AlertPanel';
import { Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const {
    mqttStatus,
    deviceOnline,
    lastUpdate,
    sensorData,
    tempHistory,
    altHistory,
    alertState,
    actuator,
    setLed,
    setBuzzer,
    clearHistory,
  } = useMqtt();

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      {/* Header */}
      <Header
        mqttStatus={mqttStatus}
        deviceOnline={deviceOnline}
        lastUpdate={lastUpdate}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Sensor Cards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Live Sensor Data
            </h2>
            {sensorData && (
              <span className="text-xs text-slate-600">
                ts: {sensorData.timestamp} ms
              </span>
            )}
          </div>
          <SensorCards data={sensorData} />
        </section>

        {/* Alert & Control */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlertPanel alertState={alertState} />
          <ControlPanel
            actuator={actuator}
            setLed={setLed}
            setBuzzer={setBuzzer}
          />
        </section>

        {/* Charts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Real-time Charts
            </h2>
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors bg-white/3 hover:bg-white/8 px-3 py-1.5 rounded-lg border border-white/8"
            >
              <Trash2 size={12} />
              Xóa lịch sử
            </button>
          </div>
          <Charts tempHistory={tempHistory} altHistory={altHistory} />
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 pb-4 border-t border-white/5 pt-4">
          Runner Monitoring System · ESP32 + FreeRTOS + MQTT · HiveMQ Public Broker
          <br />
          <span className="text-slate-700">broker.hivemq.com:8000/mqtt (WebSocket)</span>
        </footer>
      </main>
    </div>
  );
};

export default App;

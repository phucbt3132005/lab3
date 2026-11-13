import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ChartPoint } from '../types';
import { TrendingUp, Mountain } from 'lucide-react';

interface ChartsProps {
  tempHistory: ChartPoint[];
  altHistory:  ChartPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
  color: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, unit, color }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-navy-800 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p style={{ color }} className="font-bold text-sm">
        {payload[0].value.toFixed(2)} {unit}
      </p>
    </div>
  );
};

interface SingleChartProps {
  data: ChartPoint[];
  title: string;
  unit: string;
  color: string;
  referenceLines?: Array<{ y: number; label: string; color: string }>;
  Icon: React.ElementType;
  iconColor: string;
  gradientId: string;
}

const SingleChart: React.FC<SingleChartProps> = ({
  data, title, unit, color, referenceLines, Icon, iconColor, gradientId,
}) => {
  const hasData = data.length > 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-navy-800/60 p-5 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-white/5 ${iconColor}`}>
            <Icon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-500">{hasData ? `${data.length} điểm gần nhất` : 'Chờ dữ liệu MQTT...'}</p>
          </div>
        </div>
        <div className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-full border border-white/8">
          {unit}
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={v => `${v.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip unit={unit} color={color} />} />
            {referenceLines?.map(ref => (
              <ReferenceLine
                key={ref.label}
                y={ref.y}
                stroke={ref.color}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: ref.label, fill: ref.color, fontSize: 9, position: 'insideTopRight' }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 1 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <Icon size={20} className={`${iconColor} opacity-50`} />
            </div>
            <p className="text-slate-500 text-sm">Chưa có dữ liệu</p>
            <p className="text-slate-600 text-xs mt-1">Chờ kết nối MQTT...</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Charts: React.FC<ChartsProps> = ({ tempHistory, altHistory }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SingleChart
        data={tempHistory}
        title="Temperature History"
        unit="°C"
        color="#f97316"
        Icon={TrendingUp}
        iconColor="text-orange-400"
        gradientId="tempGradient"
        referenceLines={[
          { y: 38, label: '38°C High', color: '#ef4444' },
          { y: 10, label: '10°C Low',  color: '#3b82f6' },
        ]}
      />
      <SingleChart
        data={altHistory}
        title="Altitude History"
        unit="m"
        color="#06b6d4"
        Icon={Mountain}
        iconColor="text-cyan-400"
        gradientId="altGradient"
      />
    </div>
  );
};

export default Charts;

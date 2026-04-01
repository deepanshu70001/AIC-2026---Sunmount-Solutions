
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Oct 01', revenue: 40000, forecast: 42000 },
  { name: 'Oct 05', revenue: 52000, forecast: 50000 },
  { name: 'Oct 10', revenue: 48000, forecast: 55000 },
  { name: 'Oct 15', revenue: 65000, forecast: 60000 },
  { name: 'Oct 20', revenue: 72000, forecast: 68000 },
  { name: 'Today',  revenue: 94200, forecast: 85000 },
];

const SalesTrendsChart = () => {
  return (
    <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl material-3d-shadow p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-primary">Sales Trend Analysis</h3>
          <p className="text-sm text-on-surface-variant">Daily performance tracking across all regions</p>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span className="w-3 h-3 rounded-full bg-[#172434]"></span> Revenue
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <span className="w-3 h-3 rounded-full bg-[#96a4b7]"></span> Forecast
          </span>
        </div>
      </div>
      
      {/* Recharts Visualization */}
      <div className="flex-1 w-full h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#172434" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#172434" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#96a4b7" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#96a4b7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e3e4" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#74777d', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#74777d', fontSize: 12}} dx={-10} tickFormatter={(value) => `₹${value/1000}k`} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
            />
            <Area type="monotone" dataKey="forecast" stroke="#96a4b7" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" />
            <Area type="monotone" dataKey="revenue" stroke="#172434" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesTrendsChart;

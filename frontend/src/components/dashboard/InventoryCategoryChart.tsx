
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const data = [
  { name: 'Hardware Parts', value: 45 },
  { name: 'Raw Materials', value: 30 },
  { name: 'Packaging', value: 15 },
  { name: 'Miscellaneous', value: 10 },
];

const COLORS = ['#172434', '#96a4b7', '#e1e3e4', '#74777d'];

const InventoryCategoryChart = () => {
  return (
    <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl material-3d-shadow p-8 flex flex-col">
      <h3 className="text-xl font-bold text-primary mb-2">Inventory Breakdown</h3>
      <p className="text-sm text-on-surface-variant mb-6">Volume per category</p>
      
      <div className="flex-1 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(value: any) => [`${value}%`, 'Volume']}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', color: '#172434', fontWeight: 600 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InventoryCategoryChart;

import regression from 'regression';

/**
 * Analyzes system data to produce actionable ML forecasts.
 * Uses polynomial and linear regression for time-series forecasting.
 */
export function generateForecasts(orders: any[], products: any[], manufacturing: any[]) {
  const now = new Date();
  
  // 1. Sales Forecasting (Linear Regression based on completed/dispatched orders)
  const salesOrders = orders.filter(o => o.type === 'SALE' && ['COMPLETED', 'DISPATCH'].includes(o.status));
  
  // Group sales by day (last 30 days) to build time series
  const salesByDay: Record<number, number> = {};
  salesOrders.forEach(o => {
    const d = new Date(o.date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30 && diffDays >= 0) {
      try {
        const items = typeof o.products === 'string' ? JSON.parse(o.products) : o.products;
        if (Array.isArray(items)) {
          const total = items.reduce((acc: number, item: any) => acc + (Number(item.price) * Number(item.quantity)), 0);
          salesByDay[diffDays] = (salesByDay[diffDays] || 0) + total;
        }
      } catch (e) {
        console.error('ML: Failed to parse products for order', o.order_id);
      }
    }
  });

  // Data format for regression: [x, y] where x is day (0=today, 30=30 days ago), y is sales
  // We flip x so 0 is 30 days ago, and 30 is today
  const salesData: [number, number][] = [];
  for (let i = 30; i >= 0; i--) {
    salesData.push([30 - i, salesByDay[i] || 0]);
  }

  const salesModel = regression.linear(salesData);
  
  // Predict next 7 days
  const futureSales = [];
  for (let i = 1; i <= 7; i++) {
    const predicted = salesModel.predict(30 + i);
    futureSales.push({ day: `+${i}d`, expected_revenue: Math.max(0, predicted[1]) });
  }

  // 2. Inventory Depletion Forecast
  const stockoutWarnings = products.map(p => {
    // Very simple velocity estimation: looking at total sold across all sales and dividing by 30 days
    let sold = 0;
    salesOrders.forEach(o => {
      try {
        const items = typeof o.products === 'string' ? JSON.parse(o.products) : o.products;
        if (Array.isArray(items)) {
          const match = items.find((i: any) => i.product_code === p.product_code);
          if (match) sold += Number(match.quantity);
        }
      } catch (e) {
        // Silently skip malformed items
      }
    });
    const dailyVelocity = sold / 30;
    const daysUntilStockout = dailyVelocity > 0 ? p.quantity / dailyVelocity : 999;
    
    return {
      product_code: p.product_code,
      name: p.name,
      current_stock: p.quantity,
      daily_velocity: Number(dailyVelocity.toFixed(2)),
      days_until_stockout: daysUntilStockout,
      risk: daysUntilStockout < 7 ? 'HIGH' : daysUntilStockout < 15 ? 'MEDIUM' : 'LOW'
    };
  }).filter(p => p.risk !== 'LOW').sort((a, b) => a.days_until_stockout - b.days_until_stockout);

  // 3. Manufacturing Lead Time & Bottleneck Analysis
  // Compare start and end dates to find avg completion time per quantity
  const completedBatches = manufacturing.filter(m => m.status === 'COMPLETED' && m.end_date);
  
  const mfgData: [number, number][] = []; // [total_output_qty, duration_hours]
  
  completedBatches.forEach(b => {
    const start = new Date(b.start_date).getTime();
    const end = new Date(b.end_date).getTime();
    const durationHours = (end - start) / (1000 * 60 * 60); // Hours
    
    try {
      const output = typeof b.output === 'string' ? JSON.parse(b.output) : b.output;
      if (Array.isArray(output)) {
        const qty = output.reduce((a: number, o: any) => a + Number(o.quantity), 0);
        if (qty > 0 && durationHours > 0 && durationHours < 1000) {
          mfgData.push([qty, durationHours]);
        }
      }
    } catch (e) {
      // Skip malformed batch output
    }
  });

  let bottleneck_warning = null;
  let mfg_efficiency = 'Unknown';
  if (mfgData.length > 2) {
    const mfgModel = regression.polynomial(mfgData, { order: 2 });
    // Average time for a batch of 50 items
    const predictedTimeFor50 = mfgModel.predict(50)[1];
    
    if (predictedTimeFor50 > 48) { // If it takes more than 48 hours for 50 items
      bottleneck_warning = 'High probability of production bottlenecks detected. Avg lead time for standard batches exceeds 48h.';
      mfg_efficiency = 'POOR';
    } else if (predictedTimeFor50 > 24) {
      mfg_efficiency = 'MODERATE';
    } else {
      mfg_efficiency = 'EFFICIENT';
    }
  }

  return {
    sales_forecast: {
      trend_equation: salesModel.string,
      r2: salesModel.r2,
      predictions_next_7_days: futureSales
    },
    inventory_risk: stockoutWarnings.slice(0, 5), // Top 5 critical items
    manufacturing_analytics: {
      data_points: mfgData.length,
      efficiency_rating: mfg_efficiency,
      bottleneck_warning
    }
  };
}

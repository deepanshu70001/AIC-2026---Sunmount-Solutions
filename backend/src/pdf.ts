import PDFDocument from 'pdfkit';

/**
 * Generates an official PDF invoice/bill for sales and purchase orders.
 */
export function generateOrderPdf(order: any, dbProducts: any[]) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Header & Logo Placeholder
  doc.fillColor('#2d3a4a').fontSize(24).font('Helvetica-Bold').text('INVENTORY PRO', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#74777d')
     .text('Enterprise Resource Planning System', 50, 75)
     .text('123 Cyber Hub, India', 50, 90);

  // Document Title
  const isSale = order.type === 'SALE';
  const docTitle = isSale 
    ? (order.status === 'QUOTATION' ? 'PROFORMA INVOICE / QUOTATION' : 'TAX INVOICE') 
    : 'PURCHASE ORDER';
    
  doc.fillColor('#2d3a4a').fontSize(20).font('Helvetica-Bold').text(docTitle, 50, 130, { align: 'right' });

  // Order Info
  doc.fontSize(10).fillColor('#000000').font('Helvetica')
     .text(`Order ID: ${order.order_id}`, 350, 160)
     .text(`Date: ${new Date(order.date).toLocaleDateString()}`, 350, 175)
     .text(`Status: ${order.status}`, 350, 190);

  if (order.invoice_number) {
    doc.text(`Invoice No: ${order.invoice_number}`, 350, 205);
  }

  // Party Info
  doc.font('Helvetica-Bold').text(isSale ? 'Billed To:' : 'Supplier:', 50, 160);
  doc.font('Helvetica').text(order.customer_supplier_id || 'Unknown', 50, 175);
  
  if (order.transport_details) {
    try {
      const t = typeof order.transport_details === 'string' ? JSON.parse(order.transport_details) : order.transport_details;
      if (t) {
        doc.font('Helvetica-Bold').text('Transport Details:', 50, 215)
           .font('Helvetica').text(`Mode: ${t.mode || 'N/A'} | Vehicle: ${t.vehicle_number || 'N/A'}`, 50, 230);
      }
    } catch (e) {
      console.error('Failed to parse transport_details', e);
    }
  }

  // Draw Line
  doc.moveTo(50, 260).lineTo(545, 260).strokeColor('#e1e3e4').stroke();

  // Table Header
  const tableTop = 290;
  doc.font('Helvetica-Bold').fontSize(10)
     .text('Item Code', 50, tableTop)
     .text('Description', 150, tableTop)
     .text('Qty', 350, tableTop, { width: 40, align: 'right' })
     .text('Unit Price', 400, tableTop, { width: 60, align: 'right' })
     .text('Amount', 470, tableTop, { width: 75, align: 'right' });
     
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

  // Table Rows
  let y = tableTop + 30;
  let subtotal = 0;

  let products: any[] = [];
  try {
    products = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
    if (!Array.isArray(products)) products = [];
  } catch (e) {
    console.error('Failed to parse order.products', e);
  }

  products.forEach((item: any) => {
    const dbP = dbProducts.find(p => p.product_code === item.product_code);
    const desc = dbP?.name || 'Unknown Product';
    const amount = Number(item.price) * Number(item.quantity);
    subtotal += amount;

    doc.font('Helvetica').fontSize(10)
       .text(item.product_code, 50, y)
       .text(desc, 150, y, { width: 190, lineBreak: false })
       .text(item.quantity.toString(), 350, y, { width: 40, align: 'right' })
       .text(`Rs. ${Number(item.price).toFixed(2)}`, 400, y, { width: 60, align: 'right' })
       .text(`Rs. ${amount.toFixed(2)}`, 470, y, { width: 75, align: 'right' });
       
    y += 20;

    // Page break if too long
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });

  doc.moveTo(50, y + 10).lineTo(545, y + 10).stroke();

  // Totals
  y += 30;
  doc.font('Helvetica-Bold').fontSize(12)
     .text('Total Amount:', 350, y, { width: 110, align: 'right' })
     .text(`Rs. ${subtotal.toFixed(2)}`, 470, y, { width: 75, align: 'right' });

  // Compliance Info (if applicable)
  if (order.eway_bill_number || order.compliance_meta) {
    y += 40;
    doc.fillColor('#006b5a').fontSize(10).text('Compliance Information:', 50, y);
    if (order.eway_bill_number) doc.fillColor('#44474c').font('Helvetica').text(`E-Way Bill: ${order.eway_bill_number}`, 50, y + 15);
  }

  // Footer
  doc.fontSize(8).fillColor('#74777d')
     .text('This is a computer generated document and does not require a physical signature.', 50, 780, { align: 'center', width: 495 });

  return doc;
}
/**
 * Generates a comprehensive Inventory Status Report PDF.
 */
export function generateInventoryPdf(products: any[]) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.fillColor('#2d3a4a').fontSize(24).font('Helvetica-Bold').text('INVENTORY PRO', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#74777d')
     .text('Current Inventory Status Report', 50, 75)
     .text(`Generated: ${new Date().toLocaleString()}`, 50, 90);

  doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e1e3e4').stroke();

  const tableTop = 140;
  doc.font('Helvetica-Bold').fontSize(9)
     .text('Code', 50, tableTop)
     .text('Product Name', 120, tableTop)
     .text('Qty', 350, tableTop, { width: 50, align: 'right' })
     .text('Price', 400, tableTop, { width: 60, align: 'right' })
     .text('Total Value', 470, tableTop, { width: 75, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

  let y = tableTop + 30;
  let grandTotal = 0;

  products.forEach(p => {
    const total = p.price * p.quantity;
    grandTotal += total;

    doc.font('Helvetica').fontSize(9).fillColor(p.quantity < 10 ? '#ba1a1a' : '#000000')
       .text(p.product_code, 50, y)
       .text(p.name, 120, y, { width: 220, lineBreak: false })
       .text(p.quantity.toString(), 350, y, { width: 50, align: 'right' })
       .text(`Rs. ${p.price.toFixed(2)}`, 400, y, { width: 60, align: 'right' })
       .text(`Rs. ${total.toFixed(2)}`, 470, y, { width: 75, align: 'right' });

    y += 18;
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  });

  doc.moveTo(50, y + 10).lineTo(545, y + 10).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#2d3a4a')
     .text('Grand Total Inventory Value:', 300, y + 25)
     .text(`Rs. ${grandTotal.toFixed(2)}`, 450, y + 25, { width: 95, align: 'right' });

  return doc;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildComplianceSummary = exports.evaluateDispatchCompliance = exports.extractPartyId = void 0;
const EWAY_BILL_THRESHOLD_INR = Number(process.env.EWAY_BILL_THRESHOLD_INR || 50000);
const EWAY_BILL_MODE = String(process.env.EWAY_BILL_MODE || 'SIMULATED').trim().toUpperCase();
const EWAY_BILL_API_URL = String(process.env.EWAY_BILL_API_URL || '').trim();
const EWAY_BILL_AUTH_TOKEN = String(process.env.EWAY_BILL_AUTH_TOKEN || '').trim();
const EWAY_TRANSPORT_STRICT = String(process.env.EWAY_TRANSPORT_STRICT || 'false').trim().toLowerCase() === 'true';
const BLOCKED_PARTIES = new Set(String(process.env.COMPLIANCE_BLOCKED_PARTIES || '')
    .split(',')
    .map(value => value.trim().toUpperCase())
    .filter(Boolean));
const COMPLIANCE_PROFILES = {
    'CUST-1001': {
        partyId: 'CUST-1001',
        gstin: '36AABCT3518Q1ZV',
        filingStatus: 'COMPLIANT',
        itcRisk: 'LOW',
        reason: 'All recent GSTR filings are consistent.'
    },
    'CUST-1002': {
        partyId: 'CUST-1002',
        gstin: '27AAACL0149C1ZQ',
        filingStatus: 'COMPLIANT',
        itcRisk: 'LOW',
        reason: 'No return anomalies detected.'
    },
    'CUST-1003': {
        partyId: 'CUST-1003',
        gstin: '27AABCM1120H1Z2',
        filingStatus: 'RETURN_PENDING',
        itcRisk: 'MEDIUM',
        reason: 'Recent return filing delays detected; monitor dispatch risk.'
    },
    'SUP-2001': {
        partyId: 'SUP-2001',
        gstin: '22AACCJ4552A1ZT',
        filingStatus: 'COMPLIANT',
        itcRisk: 'LOW',
        reason: 'Supplier filings are healthy and reconcilable.'
    },
    'SUP-2002': {
        partyId: 'SUP-2002',
        gstin: '09AAACH7409R1Z4',
        filingStatus: 'COMPLIANT',
        itcRisk: 'LOW',
        reason: 'Supplier GST posture is stable.'
    },
    'SUP-2003': {
        partyId: 'SUP-2003',
        gstin: '24AABCB8841R1Z6',
        filingStatus: 'BLOCKED',
        itcRisk: 'HIGH',
        reason: 'Successive GST return defaults can trigger E-Way Bill portal blocks.'
    }
};
const round2 = (value) => Number((value || 0).toFixed(2));
const hashValue = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};
const deriveHsnCode = (productCode) => {
    const normalized = String(productCode || '').toUpperCase();
    if (normalized.startsWith('STL') || normalized.startsWith('SS-'))
        return '7214';
    if (normalized.startsWith('COP'))
        return '7408';
    if (normalized.startsWith('PVC'))
        return '3917';
    if (normalized.startsWith('IND-BLT'))
        return '7318';
    if (normalized.startsWith('BRG'))
        return '8482';
    if (normalized.startsWith('WLD'))
        return '8311';
    if (normalized.startsWith('ALM'))
        return '7606';
    return '8479';
};
const extractPartyId = (value) => {
    if (!value)
        return null;
    const match = String(value).toUpperCase().match(/([A-Z]{3,5}-\d{3,6})/);
    return match?.[1] || null;
};
exports.extractPartyId = extractPartyId;
const resolvePartyCompliance = (partyId) => {
    if (partyId && BLOCKED_PARTIES.has(partyId)) {
        return {
            partyId,
            gstin: 'NA',
            filingStatus: 'BLOCKED',
            itcRisk: 'HIGH',
            reason: 'Blocked via COMPLIANCE_BLOCKED_PARTIES override.'
        };
    }
    if (partyId && COMPLIANCE_PROFILES[partyId]) {
        return COMPLIANCE_PROFILES[partyId];
    }
    return {
        partyId: partyId || 'UNMAPPED',
        gstin: '27AABCU9603R1ZX',
        filingStatus: 'COMPLIANT',
        itcRisk: 'LOW',
        reason: 'Auto-assessed as compliant due to missing profile.'
    };
};
const normalizeTransportDetails = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalizedVehicle = String(source.vehicle_number || source.vehicleNumber || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
    const vehicle_number = normalizedVehicle || 'TS09AB1234';
    if (EWAY_TRANSPORT_STRICT && !/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(vehicle_number)) {
        throw new Error('Valid transport vehicle number is required for E-Way Bill generation');
    }
    const parsedDistance = Number(source.distance_km ?? source.distanceKm);
    const distance_km = Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 120;
    if (EWAY_TRANSPORT_STRICT && distance_km <= 0) {
        throw new Error('Transport distance must be greater than 0');
    }
    const transporter_id = String(source.transporter_id || source.transporterId || 'TRN-001').trim().toUpperCase();
    const modeRaw = String(source.mode || 'ROAD').trim().toUpperCase();
    const mode = ['ROAD', 'RAIL', 'AIR', 'SHIP'].includes(modeRaw)
        ? modeRaw
        : 'ROAD';
    return { vehicle_number, transporter_id, distance_km, mode };
};
const calculateTaxSummary = (orderLines, products) => {
    const productMap = new Map(products.map(product => [product.product_code, product]));
    const lines = [];
    let taxableValue = 0;
    let gstValue = 0;
    for (const line of orderLines) {
        const product = productMap.get(line.product_code);
        const gst_rate = Number.isFinite(line.gst_rate)
            ? Number(line.gst_rate)
            : Number.isFinite(product?.gst_rate)
                ? Number(product?.gst_rate)
                : 18;
        const hsn_code = String(line.hsn_code || product?.hsn_code || deriveHsnCode(line.product_code));
        const taxable = round2(line.price * line.quantity);
        const gst = round2((taxable * gst_rate) / 100);
        taxableValue += taxable;
        gstValue += gst;
        lines.push({
            product_code: line.product_code,
            hsn_code,
            gst_rate,
            taxable_value: taxable,
            gst_value: gst,
            line_total: round2(taxable + gst)
        });
    }
    return {
        taxableValue: round2(taxableValue),
        gstValue: round2(gstValue),
        invoiceValue: round2(taxableValue + gstValue),
        lines
    };
};
const requestEwayBill = async (payload, orderId, distanceKm) => {
    if (EWAY_BILL_MODE === 'LIVE' && EWAY_BILL_API_URL && EWAY_BILL_AUTH_TOKEN) {
        const response = await fetch(EWAY_BILL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${EWAY_BILL_AUTH_TOKEN}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`E-Way Bill API failed: ${response.status} ${body}`);
        }
        const result = await response.json();
        const ewayBillNumber = String(result.ewayBillNumber || result.eway_bill_number || result.ewbNo || '').trim();
        if (!ewayBillNumber) {
            throw new Error('E-Way Bill API response missing bill number');
        }
        return {
            provider: 'GSTN_LIVE',
            ewayBillNumber,
            validUpto: result.validUpto ? new Date(result.validUpto) : new Date(Date.now() + 24 * 60 * 60 * 1000),
            ackNo: String(result.ackNo || result.ack_number || '')
        };
    }
    const now = Date.now();
    const hash = hashValue(`${orderId}-${payload.transport.vehicle_number}-${now}`);
    const ewayBillNumber = `EWB2${new Date().getFullYear()}${String(hash).slice(0, 8).padEnd(8, '0')}`;
    const validityHours = Math.max(24, Math.ceil(distanceKm / 100) * 24);
    return {
        provider: 'SIMULATED_GSTN',
        ewayBillNumber,
        validUpto: new Date(Date.now() + validityHours * 60 * 60 * 1000),
        ackNo: `ACK-${String(hash).slice(0, 10)}`
    };
};
const evaluateDispatchCompliance = async (input) => {
    const partyId = (0, exports.extractPartyId)(input.customerSupplierId);
    const complianceProfile = resolvePartyCompliance(partyId);
    const taxSummary = calculateTaxSummary(input.products, input.productCatalog);
    const transport = normalizeTransportDetails(input.transportDetails);
    const invoiceNumber = String(input.invoiceNumber || '').trim() || `INV-${input.orderId.slice(0, 8).toUpperCase()}`;
    const ewayBillRequired = taxSummary.invoiceValue >= EWAY_BILL_THRESHOLD_INR;
    const complianceBase = {
        generatedAt: new Date().toISOString(),
        partyId: complianceProfile.partyId,
        gstin: complianceProfile.gstin,
        filingStatus: complianceProfile.filingStatus,
        filingReason: complianceProfile.reason,
        taxSummary,
        transport,
        thresholdInr: EWAY_BILL_THRESHOLD_INR
    };
    if (!ewayBillRequired) {
        return {
            invoice_number: invoiceNumber,
            transport_details: JSON.stringify(transport),
            eway_bill_required: false,
            eway_bill_status: 'NOT_REQUIRED',
            compliance_meta: JSON.stringify({
                ...complianceBase,
                ewayBill: {
                    status: 'NOT_REQUIRED',
                    reason: 'Invoice value below threshold'
                }
            })
        };
    }
    if (complianceProfile.filingStatus !== 'COMPLIANT') {
        throw new Error(`E-Way Bill blocked for ${complianceProfile.partyId}. ${complianceProfile.reason}`);
    }
    const ewayPayload = {
        invoice: {
            invoiceNumber,
            orderId: input.orderId,
            invoiceValue: taxSummary.invoiceValue
        },
        party: {
            id: complianceProfile.partyId,
            gstin: complianceProfile.gstin
        },
        taxLines: taxSummary.lines,
        transport
    };
    const ewayResponse = await requestEwayBill(ewayPayload, input.orderId, transport.distance_km);
    return {
        invoice_number: invoiceNumber,
        transport_details: JSON.stringify(transport),
        eway_bill_required: true,
        eway_bill_status: 'GENERATED',
        eway_bill_number: ewayResponse.ewayBillNumber,
        eway_bill_generated_at: new Date(),
        eway_bill_valid_upto: ewayResponse.validUpto,
        compliance_meta: JSON.stringify({
            ...complianceBase,
            ewayBill: {
                status: 'GENERATED',
                provider: ewayResponse.provider,
                number: ewayResponse.ewayBillNumber,
                ackNo: ewayResponse.ackNo,
                validUpto: ewayResponse.validUpto.toISOString()
            }
        })
    };
};
exports.evaluateDispatchCompliance = evaluateDispatchCompliance;
const buildComplianceSummary = async (prisma) => {
    const [orders, products] = await Promise.all([
        prisma.order.findMany({ orderBy: { date: 'desc' } }),
        prisma.product.findMany({ select: { product_code: true, name: true, hsn_code: true, gst_rate: true } })
    ]);
    const salesDispatch = orders.filter((order) => order.type === 'SALE' && order.status === 'DISPATCH');
    const salesOpen = orders.filter((order) => order.type === 'SALE' && order.status !== 'DISPATCH');
    const ewayGenerated = salesDispatch.filter((order) => order.eway_bill_status === 'GENERATED').length;
    const ewayRequiredPending = salesDispatch.filter((order) => order.eway_bill_required && !order.eway_bill_number).length;
    let blockedOpenDispatchRisk = 0;
    for (const order of salesOpen) {
        const lines = (() => {
            try {
                return JSON.parse(order.products || '[]');
            }
            catch {
                return [];
            }
        })();
        const taxSummary = calculateTaxSummary(lines, products);
        const profile = resolvePartyCompliance((0, exports.extractPartyId)(order.customer_supplier_id));
        if (taxSummary.invoiceValue >= EWAY_BILL_THRESHOLD_INR && profile.filingStatus !== 'COMPLIANT') {
            blockedOpenDispatchRisk += 1;
        }
    }
    let expectedItc = 0;
    let matchedItc = 0;
    const discrepancies = [];
    const purchaseOrders = orders.filter((order) => order.type === 'PURCHASE' && ['PAID', 'COMPLETED'].includes(String(order.status || '').toUpperCase()));
    for (const order of purchaseOrders) {
        const lines = (() => {
            try {
                return JSON.parse(order.products || '[]');
            }
            catch {
                return [];
            }
        })();
        const taxSummary = calculateTaxSummary(lines, products);
        const profile = resolvePartyCompliance((0, exports.extractPartyId)(order.customer_supplier_id));
        const matchFactor = profile.itcRisk === 'LOW' ? 0.97 : profile.itcRisk === 'MEDIUM' ? 0.86 : 0.72;
        const orderExpected = taxSummary.gstValue;
        const orderMatched = round2(orderExpected * matchFactor);
        const mismatch = round2(orderExpected - orderMatched);
        expectedItc += orderExpected;
        matchedItc += orderMatched;
        if (mismatch > Math.max(100, orderExpected * 0.08)) {
            discrepancies.push({
                order_id: order.order_id,
                supplier: order.customer_supplier_id || 'Unknown',
                expectedItc: round2(orderExpected),
                matchedItc: orderMatched,
                mismatchItc: mismatch,
                mismatchPercent: orderExpected > 0 ? round2((mismatch / orderExpected) * 100) : 0,
                filingStatus: profile.filingStatus
            });
        }
    }
    const profiles = Object.values(COMPLIANCE_PROFILES);
    const blockedParties = profiles.filter(profile => profile.filingStatus === 'BLOCKED').map(profile => profile.partyId);
    return {
        generatedAt: new Date().toISOString(),
        filingHealth: {
            compliantCount: profiles.filter(profile => profile.filingStatus === 'COMPLIANT').length,
            returnPendingCount: profiles.filter(profile => profile.filingStatus === 'RETURN_PENDING').length,
            blockedCount: profiles.filter(profile => profile.filingStatus === 'BLOCKED').length + BLOCKED_PARTIES.size,
            blockedParties: Array.from(new Set([...blockedParties, ...Array.from(BLOCKED_PARTIES)]))
        },
        ewayBill: {
            thresholdInr: EWAY_BILL_THRESHOLD_INR,
            totalDispatchedOrders: salesDispatch.length,
            generatedCount: ewayGenerated,
            requiredPendingCount: ewayRequiredPending,
            blockedOpenDispatchRisk
        },
        itcReconciliation: {
            expectedItc: round2(expectedItc),
            matchedItc: round2(matchedItc),
            mismatchItc: round2(expectedItc - matchedItc),
            discrepancyCount: discrepancies.length,
            discrepancies: discrepancies.slice(0, 8)
        }
    };
};
exports.buildComplianceSummary = buildComplianceSummary;

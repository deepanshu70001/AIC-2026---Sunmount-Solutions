"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
require("dotenv/config");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || '' });
router.post('/', async (req, res) => {
    const { messages } = req.body;
    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured in backend/.env' });
    }
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }
    try {
        // 1. Gather live context from the database for the AI
        const products = await prisma.product.findMany({ select: { product_code: true, name: true, quantity: true, price: true } });
        const totalInventoryValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const lowStockItems = products.filter((p) => p.quantity < 15);
        const systemPrompt = `
      You are the Inventory Pro Management Assistant, an expert AI embedded within an SME Inventory Management system.
      Always be professional, concise, and helpful. Format your responses using markdown where appropriate (lists, bold text, code blocks).
      Keep your answers brief unless asked for details. Use the ₹ symbol for currency.

      Here is the real-time context of the current SME database:
      - Total Inventory Valuation: ₹${totalInventoryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      - Distinct Products in Stock: ${products.length}
      - LOW STOCK WARNING: There are ${lowStockItems.length} items below minimum threshold (15 units):
        ${lowStockItems.map((i) => `* ${i.name} (${i.product_code}): ${i.quantity} units left`).join('\n')}

      Answer the user's queries accurately based on this information. If they ask about something not in this context, answer politely based on general inventory management principles.
    `;
        // 2. Format messages for Groq
        const groqMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];
        // 3. Stream or await response (we'll await for simplicity here)
        const chatCompletion = await groq.chat.completions.create({
            messages: groqMessages,
            model: 'llama3-8b-8192', // Super fast Groq model!
            temperature: 0.5,
            max_tokens: 500,
        });
        res.json({
            role: 'assistant',
            content: chatCompletion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
        });
    }
    catch (error) {
        console.error('Groq Error:', error);
        res.status(500).json({ error: 'Failed to communicate with Groq AI API.' });
    }
});
exports.default = router;

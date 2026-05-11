import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

export const maxDuration = 60; // Set max duration if using Vercel Pro, otherwise it defaults to 10-15s

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Initialize worker with /tmp directory for cache, required for Vercel serverless
    const worker = await createWorker('eng', 1, {
      cachePath: '/tmp',
      logger: (m) => console.log(m),
    });

    const { data: { text } } = await worker.recognize(imageBase64);

    await worker.terminate();

    // Parse the text to find amount, merchant, and date
    // Filter out very short or noisy lines
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 2 && /[a-zA-Z0-9]/.test(l));

    let amount = "";
    let merchant = "";
    let date: Date | null = null;

    // Find the first line that has mostly alphabetical characters to be the merchant
    for (const line of lines) {
      const alphaChars = line.replace(/[^a-zA-Z]/g, '').length;
      if (alphaChars >= 3) {
        merchant = line;
        break;
      }
    }

    // Fallback heuristic: Many receipts have a stylized logo at the top that OCR misses,
    // but the store name appears in plain text at the bottom (e.g. "Thank you for shopping at Walgreens").
    // We can check the raw text against a list of known popular merchants.
    const knownMerchants = [
      "Walgreens", "Walmart", "Target", "CVS", "Starbucks", "McDonalds",
      "Dunkin", "Subway", "Costco", "Trader Joe's", "Whole Foods", "IKEA",
      "Home Depot", "Lowe's", "Best Buy", "Taco Bell", "Wendy's", "Burger King",
      "Uber", "Lyft", "Amazon", "Kroger", "Safeway", "Publix", "H-E-B", "Chipotle", "Domino's", "Papa John's"
    ];

    const textLower = text.toLowerCase();
    for (const known of knownMerchants) {
      // Remove punctuation for simpler matching
      const simpleKnown = known.toLowerCase().replace(/[^a-z0-9]/g, '');
      const simpleText = textLower.replace(/[^a-z0-9]/g, '');
      if (simpleText.includes(simpleKnown)) {
        merchant = known;
        break;
      }
    }

    // Regex for amounts like $12.34, 12.34, 12,34, $ 12.34
    const amountRegex = /\$?\s*(\d+[\.,]\d{2})/;
    let maxAmount = 0;

    // Look for total
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      // Also track the max amount found as a fallback
      const matchAny = line.match(amountRegex);
      if (matchAny) {
        const val = parseFloat(matchAny[1].replace(',', '.'));
        if (val > maxAmount) maxAmount = val;
      }

      if (line.includes('total') || line.includes('amount') || line.includes('due') || line.includes('balance')) {
        // Try to find amount on the same line
        let match = line.match(amountRegex);

        // If not on the same line, check the next 1-2 lines
        if (!match && i + 1 < lines.length) {
          match = lines[i + 1].match(amountRegex);
        }
        if (!match && i + 2 < lines.length) {
          match = lines[i + 2].match(amountRegex);
        }

        if (match) {
          amount = match[1].replace(',', '.');
          // Only break if it's a reasonable total, sometimes "Total Savings" exists.
          // But we will just take the first matching amount next to a 'total' keyword.
          break;
        }
      }
    }

    if (!amount && maxAmount > 0) {
      amount = maxAmount.toFixed(2);
    }

    // Regex for date like MM/DD/YYYY or similar
    const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    for (const line of lines) {
      const match = line.match(dateRegex);
      if (match) {
        // try to parse
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      merchant: merchant || "Unknown Merchant",
      amount: amount || "",
      date: date ? date.toISOString() : new Date().toISOString()
    });

  } catch (error) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
  }
}

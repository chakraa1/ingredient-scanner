const dotenv = require('dotenv');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

if (fs.existsSync(path.join(__dirname, '.env'))) {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

// Configure multer for image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50kb' }));

if (!process.env.CLAUDE_API_KEY) {
  console.error('ERROR: CLAUDE_API_KEY is required. Set it as an environment variable in your deployment platform.');
  process.exit(1);
}

const ANALYSIS_PROMPT = `You are a world-class toxicologist, nutritional scientist, and regulatory expert with deep knowledge of:
- IARC carcinogen classifications (Groups 1, 2A, 2B)
- FDA, EFSA, and WHO ingredient safety databases
- Environmental Working Group (EWG) toxicity ratings
- Research literature on food additives, preservatives, colorants, and cosmetic chemicals
- Regulatory frameworks for food, skincare, supplements, and personal care products
- EU RASFF (Rapid Alert System for Food and Feed) database patterns and alerts
- Pesticide residues, mycotoxins, heavy metals, and adulterants in spices
- Brand-specific contamination histories and regulatory actions
- Geographic-specific adulteration patterns (especially India, China, Southeast Asia)
- Fumigants, pesticides, and processing contaminants in herbs and spices

Your task is to evaluate a product or brand name for safety based on its likely ingredients, typical formulation, and known contamination risks. If an image is provided, analyze the product label, brand name, and ingredient list visible in the image.

CRITICAL REQUIREMENTS:
- Include ALL known contaminants, adulterants, and processing chemicals as separate ingredients
- List specific RASFF alert counts and classifications when relevant
- Mention brand-specific regulatory actions, recalls, or contamination histories
- Flag known adulteration risks for specific product types (especially spices)
- Include geographic origin risks and typical contaminants
- Provide concrete, actionable recommendations based on regulatory data
- When overall risk is high/medium, ensure corresponding ingredients are marked with appropriate risk levels
- Include processing contaminants (fumigants, pesticides, mycotoxins) as separate ingredient entries
- Distinguish between loose/unbranded vs. branded products
- Reference specific carcinogen classifications and health impacts

Return ONLY a valid JSON object and nothing else. Do not include markdown fences, explanatory text, or quotes around the JSON object.

The JSON must use this structure:
{
  "product_type": "string",
  "product_name": "string",
  "extracted_ingredients_raw": "string",
  "scan_confidence": "high|medium|low",
  "ingredients": [ ... ],
  "overall_risk": "high|medium|low|safe",
  "flagged_count": number,
  "summary": "string",
  "recommendation": "string"
}

If specific ingredients cannot be known from the product name or image, infer likely ingredients and clearly note uncertainty in the summary and recommendation.`;

app.post('/api/analyze', upload.single('productImage'), async (req, res) => {
  const productName = (req.body.productName || req.query.productName || '').trim();
  const productImage = req.file;

  if (!productName && !productImage) {
    return res.status(400).json({ error: 'Either product name or product image is required. Please enter a product name or upload an image.' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY is not configured. Please add it to your .env file.' });
  }

  // System prompt for the analysis
  const systemPrompt = ANALYSIS_PROMPT;

  let messages;

  if (productImage) {
    // Handle image analysis
    const imageBuffer = fs.readFileSync(productImage.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = productImage.mimetype;

    const userMessage = `Please analyze this product image for brand name, ingredients, and packaging details, then perform a comprehensive safety analysis including:
- Specific RASFF alerts and contamination data for this product/brand
- Known adulteration risks and banned substances (list each as separate ingredients)
- Brand-specific regulatory history and recalls
- Geographic origin contamination patterns
- Processing contaminants, fumigants, and mycotoxins (list as separate ingredients)
- Pesticide residues and heavy metals (list as separate ingredients)
- Detailed hazard classifications with IARC groups
- Concrete safety recommendations based on regulatory data

IMPORTANT: When listing ingredients, include BOTH the main product ingredients AND any known contaminants/adulterants as separate entries with appropriate risk levels.

Return ONLY a raw JSON safety report without any explanation or markdown fences.`;

    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: userMessage
          }
        ]
      }
    ];

    // Clean up uploaded file
    fs.unlinkSync(productImage.path);
  } else {
    // Handle text analysis
    const userMessage = `Product: ${productName}

Please perform a comprehensive safety analysis including:
- Specific RASFF alerts and contamination data for this product/brand
- Known adulteration risks and banned substances (list each as separate ingredients)
- Brand-specific regulatory history and recalls
- Geographic origin contamination patterns
- Processing contaminants, fumigants, and mycotoxins (list as separate ingredients)
- Pesticide residues and heavy metals (list as separate ingredients)
- Detailed hazard classifications with IARC groups
- Concrete safety recommendations based on regulatory data

IMPORTANT: When listing ingredients, include BOTH the main product ingredients AND any known contaminants/adulterants as separate entries with appropriate risk levels.

Return ONLY a raw JSON safety report without any explanation or markdown fences.`;

    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage
          }
        ]
      }
    ];
  }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      temperature: 0,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages
    });

    let rawText = '';
    if (Array.isArray(response.content)) {
      const textBlock = response.content.find(block => block.type === 'text');
      if (textBlock && typeof textBlock.text === 'string') {
        rawText = textBlock.text;
      } else {
        rawText = response.content
          .filter(block => block.type === 'text' && typeof block.text === 'string')
          .map(block => block.text)
          .join('\n');
      }
    } else if (typeof response.content === 'string') {
      rawText = response.content;
    } else if (Array.isArray(response.output) && response.output[0]?.content?.[0]?.text) {
      rawText = response.output[0].content[0].text;
    } else {
      rawText = JSON.stringify(response);
    }

    const jsonText = extractJsonFromText(rawText);
    
    let analysisData;
    try {
      analysisData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parse error. Raw response:', rawText);
      return res.status(500).json({
        error: 'Failed to parse AI response. The product name may be too vague or the response was not valid JSON.',
        raw: rawText.substring(0, 500)
      });
    }

    res.json(analysisData);

  } catch (err) {
    console.error('Claude API error:', err);

    const msg = err.message || '';
    if (msg.includes('invalid_api_key') || msg.includes('authentication')) {
      return res.status(401).json({ error: 'Invalid Claude API key. Please check your CLAUDE_API_KEY in .env' });
    }
    if (msg.includes('overloaded') || msg.includes('rate_limit')) {
      return res.status(429).json({ error: 'API rate limit exceeded. Please wait and try again.' });
    }
    res.status(500).json({ error: 'Analysis failed: ' + msg });
  }
});

function extractJsonFromText(rawText) {
  if (!rawText) return '';
  let cleaned = String(rawText)
    .replace(/\r\n/g, '\n')
    .replace(/```(?:json)?/gi, '')
    .replace(/\n```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'claude-opus-4-1-20250805' });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`\n✅ Ingredient Safety Scanner running at http://localhost:${PORT}`);
  console.log(`   Model: claude-opus-4-1-20250805 with check-safe skill`);
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('\n⚠️  CLAUDE_API_KEY is not set!');
    console.warn('   Please add CLAUDE_API_KEY=your_key to your .env file\n');
  }
});

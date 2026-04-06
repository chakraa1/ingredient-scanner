const rawText = `\`\`\`json
{
  "product_type": "spice/seasoning",
  "product_name": "mdh kashmiri red chilly powder",
  "extracted_ingredients_raw": "Dried Kashmiri red chillies (likely with potential additives)",
  "scan_confidence": "medium",
  "ingredients": [
    {
      "name": "Kashmiri Red Chillies",
      "risk_level": "safe",
      "concerns": []
    },
    {
      "name": "Sudan Dyes (Sudan I-IV)",
      "risk_level": "high",
      "concerns": ["Potential carcinogen (IARC Group 3)", "Banned food additive", "Genotoxic properties", "Common adulterant in chilli powders"]
    },
    {
      "name": "Lead chromate",
      "risk_level": "high",
      "concerns": ["Known carcinogen", "Heavy metal contamination", "Neurotoxic", "Sometimes used as adulterant for color enhancement"]
    },
    {
      "name": "Aflatoxins",
      "risk_level": "medium",
      "concerns": ["Natural mycotoxin contamination", "IARC Group 1 carcinogen", "Common in improperly stored spices"]
    }
  ],
  "overall_risk": "medium",
  "flagged_count": 2,
  "summary": "MDH Kashmiri Red Chilli Powder should primarily contain ground Kashmiri chillies, which are naturally safe. However, there have been documented cases of chilli powder adulteration in South Asian markets, including Sudan dyes for color enhancement and heavy metal contamination. MDH has faced regulatory scrutiny in some countries for quality control issues, including recalls in Singapore and Hong Kong for ethylene oxide contamination in other spice products.",
  "recommendation": "Purchase from reputable retailers and look for products with quality certifications (FSSAI, ISO). Check for batch testing information if available. Avoid products with unnaturally bright red color or suspiciously low prices. Consider organic certified versions to minimize contamination risk. Store in cool, dry conditions to prevent aflatoxin development."
}
\`\`\`
`;

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

  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned;
}

const jsonText = extractJsonFromText(rawText);
console.log('jsonText:\n', jsonText);

try {
  const parsed = JSON.parse(jsonText);
  console.log('PARSED:', parsed);
} catch (err) {
  console.error('Failed to parse JSON:', err.message);
  console.error('Cleaned JSON text:\n', jsonText);
}

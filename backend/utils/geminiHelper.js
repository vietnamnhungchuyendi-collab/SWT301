import dotenv from 'dotenv';
dotenv.config();

/**
 * Call Gemini API using a rotated pool of API keys configured in GEMINI_API_KEYS (comma separated)
 * or falling back to GEMINI_API_KEY.
 */
export const callGeminiAPI = async (userPrompt, systemInstruction = null, mimeType = "application/json", temperature = 0.2) => {
  let keys = [];
  if (process.env.GEMINI_API_KEYS) {
    keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  }
  if (process.env.GEMINI_API_KEY) {
    const splitKey = process.env.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
    keys.push(...splitKey);
  }
  
  // Deduplicate
  keys = [...new Set(keys)];

  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY or GEMINI_API_KEYS is not configured.');
  }

  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`[Gemini Helper] Attempting call with API Key index ${i}...`);
    try {
      const body = {
        contents: Array.isArray(userPrompt) ? userPrompt : [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature }
      };

      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      if (mimeType) {
        body.generationConfig.responseMimeType = mimeType;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          console.log(`[Gemini Helper] Call succeeded with key index ${i}`);
          return data.candidates[0].content.parts[0].text.trim();
        }
      } else {
        const errText = await response.text();
        const status = response.status;
        console.warn(`[Gemini Helper] Key index ${i} failed with status ${status}:`, errText);
        lastError = new Error(`Gemini API Error (status ${status}): ${errText}`);
      }
    } catch (err) {
      console.error(`[Gemini Helper] Exception with key index ${i}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini API keys in the pool were exhausted or failed.');
};

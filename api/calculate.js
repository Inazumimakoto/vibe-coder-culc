export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { expression } = req.body;

    if (!expression) {
        return res.status(400).json({ error: '数式を入力してください！' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    try {
        const prompt = `Calculate: ${expression}

Return ONLY the numerical result. No explanation, no comments, just the number.
If invalid, return "Error".`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 150,
                    },
                }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error('Gemini API error:', JSON.stringify(data.error));
            return res.status(500).json({
                error: 'AIがお休み中です...また後で試してね😅',
                debug: data.error
            });
        }

        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            return res.status(500).json({ error: 'AIが無言になっちゃった...🤐' });
        }

        return res.status(200).json({ result: result.trim() });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'サーバーエラーが発生しました。もう一度お試しください。' });
    }
}

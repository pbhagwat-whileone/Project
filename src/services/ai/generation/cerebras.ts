export async function generateCerebrasContent(
    model: string,
    prompt: string,
    options?: { isJson?: boolean; responseSchema?: any }
): Promise<string> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
        throw new Error("CEREBRAS_API_KEY is not configured");
    }

    const payload: any = {
        model: model,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    };

    if (options?.isJson) {
        payload.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cerebras API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return text;
}



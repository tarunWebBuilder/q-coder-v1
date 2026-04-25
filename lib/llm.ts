import Together from "together-ai";

type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type CompletionOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  chatId?: string;
};

type ProviderConfig = {
  provider: "together" | "groq" | "mistral";
  model: string;
  apiKey: string | undefined;
  baseURL?: string;
};

type MistralCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

function getProviderConfig(model: string): ProviderConfig {
  if (model.startsWith("groq/")) {
    return {
      provider: "groq",
      model: model.replace("groq/", ""),
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    };
  }

  if (model.startsWith("mistral/")) {
    return {
      provider: "mistral",
      model: model.replace("mistral/", ""),
      apiKey: process.env.MISTRAL_API_KEY,
    };
  }

  return {
    provider: "together",
    model,
    apiKey: process.env.TOGETHER_API_KEY,
  };
}

function requireApiKey(config: ProviderConfig) {
  if (!config.apiKey) {
    throw new Error(`Missing API key for ${config.provider}`);
  }
}

function getTogetherClient(config: ProviderConfig, chatId?: string) {
  requireApiKey(config);

  const options: ConstructorParameters<typeof Together>[0] = {
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  };

  if (process.env.HELICONE_API_KEY && config.provider === "together") {
    options.baseURL = "https://together.helicone.ai/v1";
    options.defaultHeaders = {
      "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      "Helicone-Property-appname": "LlamaCoder",
      "Helicone-Session-Id": chatId,
      "Helicone-Session-Name": "LlamaCoder Chat",
    };
  }

  return new Together(options);
}

function getTextFromMistralResponse(response: MistralCompletionResponse) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text || "").join("");
  }

  return "";
}

async function createMistralCompletion(options: CompletionOptions) {
  const config = getProviderConfig(options.model);
  requireApiKey(config);

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Mistral completion failed: ${response.status} ${errorText}`,
    );
  }

  return getTextFromMistralResponse(await response.json());
}

export function isMistralModel(model: string) {
  return model.startsWith("mistral/");
}

export async function createTextCompletion(options: CompletionOptions) {
  const config = getProviderConfig(options.model);

  if (config.provider === "mistral") {
    return createMistralCompletion(options);
  }

  const client = getTogetherClient(config, options.chatId);
  const response = await client.chat.completions.create({
    model: config.model,
    messages: options.messages as any,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  });

  return response.choices[0].message?.content || "";
}

export async function createCompletionStream(options: CompletionOptions) {
  const config = getProviderConfig(options.model);

  if (config.provider === "mistral") {
    requireApiKey(config);

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: options.messages,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Mistral stream failed: ${response.status} ${errorText}`);
    }

    return response.body;
  }

  const client = getTogetherClient(config, options.chatId);
  const response = await client.chat.completions.create({
    model: config.model,
    messages: options.messages as any,
    stream: true,
    temperature: options.temperature,
    max_tokens: config.provider === "groq" ? 8192 : options.maxTokens,
  });

  return response.toReadableStream();
}

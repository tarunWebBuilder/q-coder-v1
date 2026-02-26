import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getMainCodingPrompt,
  screenshotToCodePrompt,
  softwareArchitectPrompt,
} from "@/lib/prompts";
import Together from "together-ai";

export async function POST(request: NextRequest) {
  try {
    const { prompt, model, quality, screenshotUrl } = await request.json();

    const prisma = getPrisma();
    const chat = await prisma.chat.create({
      data: {
        model,
        quality,
        prompt,
        title: "",
        shadcn: true,
      },
    });

    let apiKey = process.env.TOGETHER_API_KEY;
    let baseURL: string | undefined = undefined;
    let modelId = model as string;

    if (model.startsWith("groq/")) {
      modelId = model.replace("groq/", "");
      apiKey = process.env.GROQ_API_KEY;
      baseURL = "https://api.groq.com/openai/v1";
    } else if (model.startsWith("mistral/")) {
      modelId = model.replace("mistral/", "");
      apiKey = process.env.MISTRAL_API_KEY;
      baseURL = "https://api.mistral.ai/v1";
    }

    if (!apiKey) {
      console.error("Missing API key for provider", { model, baseURL });
      return NextResponse.json(
        { error: "Missing API key for selected model provider" },
        { status: 500 },
      );
    }

    let options: ConstructorParameters<typeof Together>[0] = {
      apiKey,
      baseURL,
    };
    if (process.env.HELICONE_API_KEY && !baseURL) {
      options.baseURL = "https://together.helicone.ai/v1";
      options.defaultHeaders = {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
        "Helicone-Property-appname": "LlamaCoder",
        "Helicone-Session-Id": chat.id,
        "Helicone-Session-Name": "LlamaCoder Chat",
      };
    }

    const together = new Together(options);

    const usingTogether = !baseURL;
    const titleModel = usingTogether
      ? "Qwen/Qwen3-Next-80B-A3B-Instruct"
      : modelId;
    const exampleModel = usingTogether
      ? "Qwen/Qwen3-Next-80B-A3B-Instruct"
      : modelId;
    const planModel = usingTogether ? "Qwen/Qwen3-Next-80B-A3B-Instruct" : modelId;
    const imageModel = usingTogether ? "moonshotai/Kimi-K2.5" : undefined;

    async function fetchTitle() {
      const responseForChatTitle = await together.chat.completions.create({
        model: titleModel,
        messages: [
          {
            role: "system",
            content:
              "You are a chatbot helping the user create a simple app or script, and your current job is to create a succinct title, maximum 3-5 words, for the chat given their initial prompt. Please return only the title.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });
      const title = responseForChatTitle.choices[0].message?.content || prompt;
      return title;
    }

    async function fetchTopExample() {
      const findSimilarExamples = await together.chat.completions.create({
        model: exampleModel,
        messages: [
          {
            role: "system",
            content: `You are a helpful bot. Given a request for building an app, you match it to the most similar example provided. If the request is NOT similar to any of the provided examples, return "none". Here is the list of examples, ONLY reply with one of them OR "none":

            - landing page
            - blog app
            - quiz app
            - pomodoro timer
            `,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const mostSimilarExample =
        findSimilarExamples.choices[0].message?.content || "none";
      return mostSimilarExample;
    }

    const [title, mostSimilarExample] = await Promise.all([
      fetchTitle(),
      fetchTopExample(),
    ]);

    let fullScreenshotDescription;
    if (screenshotUrl && imageModel) {
      const screenshotResponse = await together.chat.completions.create({
        model: imageModel,
        temperature: 0.4,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: screenshotToCodePrompt },
              {
                type: "image_url",
                image_url: {
                  url: screenshotUrl,
                },
              },
            ],
          },
        ],
      });

      fullScreenshotDescription =
        screenshotResponse.choices[0].message?.content;
    }

    let userMessage: string;
    if (quality === "high") {
      let initialRes = await together.chat.completions.create({
        model: planModel,
        // model: "moonshotai/Kimi-K2-Thinking",
        messages: [
          {
            role: "system",
            content: softwareArchitectPrompt,
          },
          {
            role: "user",
            content: fullScreenshotDescription
              ? fullScreenshotDescription + prompt
              : prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      });

      console.log("PLAN:", initialRes.choices[0].message?.content);

      userMessage = initialRes.choices[0].message?.content ?? prompt;
    } else if (fullScreenshotDescription) {
      userMessage =
        prompt +
        "RECREATE THIS APP AS CLOSELY AS POSSIBLE: " +
        fullScreenshotDescription;
    } else {
      userMessage = prompt;
    }

    let newChat = await prisma.chat.update({
      where: {
        id: chat.id,
      },
      data: {
        title,
        messages: {
          createMany: {
            data: [
              {
                role: "system",
                content: getMainCodingPrompt(mostSimilarExample),
                position: 0,
              },
              { role: "user", content: userMessage, position: 1 },
            ],
          },
        },
      },
      include: {
        messages: true,
      },
    });

    const lastMessage = newChat.messages
      .sort((a: { position: number; }, b: { position: number; }) => a.position - b.position)
      .at(-1);
    if (!lastMessage) throw new Error("No new message");

    return NextResponse.json({
      chatId: chat.id,
      lastMessageId: lastMessage.id,
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error creating chat";
    return NextResponse.json(
      { error: "Failed to create chat", message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";

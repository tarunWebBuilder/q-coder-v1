import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getMainCodingPrompt,
  screenshotToCodePrompt,
  softwareArchitectPrompt,
} from "@/lib/prompts";
import { createTextCompletion, isMistralModel } from "@/lib/llm";

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

    const usingTogether = !model.startsWith("groq/") && !isMistralModel(model);
    const titleModel = usingTogether
      ? "Qwen/Qwen3-Next-80B-A3B-Instruct"
      : model;
    const exampleModel = usingTogether
      ? "Qwen/Qwen3-Next-80B-A3B-Instruct"
      : model;
    const planModel = usingTogether
      ? "Qwen/Qwen3-Next-80B-A3B-Instruct"
      : model;
    const imageModel = usingTogether ? "moonshotai/Kimi-K2.5" : undefined;

    async function fetchTitle() {
      const title = await createTextCompletion({
        model: titleModel,
        chatId: chat.id,
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

      return title || prompt;
    }

    async function fetchTopExample() {
      const mostSimilarExample = await createTextCompletion({
        model: exampleModel,
        chatId: chat.id,
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

      return mostSimilarExample || "none";
    }

    const [title, mostSimilarExample] = await Promise.all([
      fetchTitle(),
      fetchTopExample(),
    ]);

    let fullScreenshotDescription;
    if (screenshotUrl && imageModel) {
      fullScreenshotDescription = await createTextCompletion({
        model: imageModel,
        chatId: chat.id,
        temperature: 0.4,
        maxTokens: 1000,
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
    }

    let userMessage: string;
    if (quality === "high") {
      const initialPlan = await createTextCompletion({
        model: planModel,
        chatId: chat.id,
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
        maxTokens: 3000,
      });

      console.log("PLAN:", initialPlan);

      userMessage = initialPlan || prompt;
    } else if (fullScreenshotDescription) {
      userMessage =
        prompt +
        "RECREATE THIS APP AS CLOSELY AS POSSIBLE: " +
        fullScreenshotDescription;
    } else {
      userMessage = prompt;
    }

    const newChat = await prisma.chat.update({
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
      .sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      )
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

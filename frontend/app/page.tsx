"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ProductGallery from "../components/ProductGallery";
import QuoteTable from "../components/QuoteTable";
import SourceList from "../components/SourceList";
import type { Product } from "../components/ProductGallery";
import type { QuotePayload } from "../components/QuoteTable";
import type { SourceItem } from "../components/SourceList";

type AssistantComponent =
  | {
      name: "ProductGallery";
      payload: Product[];
    }
  | {
      name: "QuoteResult";
      payload: {
        quote: QuotePayload;
        products: Product[];
        sources?: SourceItem[];
      };
    };

type AgentStep = {
  label: string;
  status: "running" | "completed";
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  uiComponent?: AssistantComponent;
  agentSteps?: AgentStep[];
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const SESSION_STORAGE_KEY = "b2b-agent-session-id";
const CHAT_MESSAGES_STORAGE_KEY = "b2b-agent-chat-messages";
const CONVERSATION_SUMMARY_STORAGE_KEY = "b2b-agent-conversation-summary";

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "您好，我是本企业的智能售前顾问。请问您需要了解哪款设备的参数，或者核算哪种工程的报价？",
  },
];

const EXAMPLE_QUESTIONS = [
  "500平中央空调多少钱？",
  "中央空调多少钱？",
  "化工厂耐高温阀门有什么参数要求？",
  "300平车间推荐什么空调方案？",
];

const WORKFLOW_ITEMS = [
  { title: "需求收集", desc: "设备类型、面积、场景" },
  { title: "参数匹配", desc: "匹配产品资料与工况要求" },
  { title: "方案推荐", desc: "输出候选设备与配置方向" },
  { title: "报价核算", desc: "生成预估价格与明细" },
  { title: "资料留痕", desc: "保留知识来源和咨询上下文" },
];

const SERVICE_MODULES = [
  { title: "产品资料库", desc: "设备参数与适用场景" },
  { title: "报价规则库", desc: "按品类与面积快速估算" },
  { title: "方案模板", desc: "面向客户的售前回复" },
];

function getSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function isStoredChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ChatMessage>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function readStoredMessages() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawMessages = window.localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);

    if (!rawMessages) {
      return null;
    }

    const parsedMessages = JSON.parse(rawMessages);

    if (!Array.isArray(parsedMessages)) {
      return null;
    }

    const validMessages = parsedMessages.filter(isStoredChatMessage);
    return validMessages.length > 0 ? validMessages : null;
  } catch {
    return null;
  }
}

function readStoredSummary() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(CONVERSATION_SUMMARY_STORAGE_KEY) ?? "";
}

function StatusDot({ active = true }: { active?: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        active ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]" : "bg-neutral-600"
      }`}
    />
  );
}

function inferConsultation(lastUserMessage: string) {
  const areaMatch = lastUserMessage.match(/(\d+(?:\.\d+)?)\s*(平|平方米|㎡|m2)/i);

  const device =
    ["中央空调", "高空阀门", "阀门", "管道", "电气开关", "开关"].find((item) =>
      lastUserMessage.includes(item),
    ) ?? "待识别";

  const scenario =
    ["化工厂", "电子车间", "车间", "厂房", "实验室"].find((item) =>
      lastUserMessage.includes(item),
    ) ?? "待补充";

  return {
    device,
    area: areaMatch ? `${areaMatch[1]} 平方米` : "待补充",
    scenario,
  };
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("server-session");
  const [conversationSummary, setConversationSummary] = useState("");
  const [isStorageReady, setIsStorageReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestUserMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user")?.content ?? "",
    [messages],
  );

  const consultation = useMemo(
    () => inferConsultation(latestUserMessage),
    [latestUserMessage],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const storedMessages = readStoredMessages();
    const storedSummary = readStoredSummary();
    const storedSessionId = getSessionId();
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      setSessionId(storedSessionId);

      if (storedMessages) {
        setMessages(storedMessages);
      }

      if (storedSummary) {
        setConversationSummary(storedSummary);
      }

      setIsStorageReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CONVERSATION_SUMMARY_STORAGE_KEY, conversationSummary);
  }, [conversationSummary, isStorageReady]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, isLoading]);

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage ?? inputValue;

    if (!messageToSend.trim() || isLoading) return;

    const userQuery = messageToSend.trim();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userQuery },
      { role: "assistant", content: "", agentSteps: [] },
    ]);

    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          history: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          session_id: sessionId,
          summary: conversationSummary,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let shouldStop = false;

      while (!shouldStop) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const dataStr = line.replace("data:", "").trim();
          if (dataStr === "[DONE]") {
            shouldStop = true;
            break;
          }

          try {
            const dataObj = JSON.parse(dataStr) as {
              text?: string;
              type?: string;
              content?: string;
              label?: string;
              status?: AgentStep["status"];
              name?: AssistantComponent["name"];
              payload?: AssistantComponent["payload"];
            };

            if (dataObj.text) {
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                newMessages[lastIndex] = {
                  ...newMessages[lastIndex],
                  content: newMessages[lastIndex].content + dataObj.text,
                };
                return newMessages;
              });
            }

            if (dataObj.type === "summary" && typeof dataObj.content === "string") {
              setConversationSummary(dataObj.content);
            }

            if (dataObj.type === "agent_step" && dataObj.label && dataObj.status) {
              const step: AgentStep = {
                label: dataObj.label,
                status: dataObj.status,
              };

              setMessages((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                const currentSteps = newMessages[lastIndex].agentSteps ?? [];

                newMessages[lastIndex] = {
                  ...newMessages[lastIndex],
                  agentSteps: [...currentSteps, step],
                };

                return newMessages;
              });
            }

            if (dataObj.type === "ui_component") {
              if (dataObj.name === "ProductGallery" && Array.isArray(dataObj.payload)) {
                const uiComponent: AssistantComponent = {
                  name: "ProductGallery",
                  payload: dataObj.payload,
                };

                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    uiComponent,
                  };
                  return newMessages;
                });
              }

              if (
                dataObj.name === "QuoteResult" &&
                dataObj.payload &&
                !Array.isArray(dataObj.payload) &&
                "quote" in dataObj.payload &&
                "products" in dataObj.payload
              ) {
                const uiComponent: AssistantComponent = {
                  name: "QuoteResult",
                  payload: dataObj.payload,
                };

                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    uiComponent,
                  };
                  return newMessages;
                });
              }
            }
          } catch (error) {
            console.error("JSON stream parse error:", error);
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content =
          "服务正在唤醒或网络暂时不稳定，请稍后重新发送需求。";
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      handleSend();
    }
  };

  const handleClearRecords = () => {
    const nextSessionId = createSessionId();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
      window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
      window.localStorage.removeItem(CONVERSATION_SUMMARY_STORAGE_KEY);
    }

    setSessionId(nextSessionId);
    setConversationSummary("");
    setInputValue("");
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0d10] text-neutral-200">
      <header className="shrink-0 border-b border-neutral-800 bg-[#101216]">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-[#101216]">
              <span className="h-5 w-2 rounded-sm bg-red-600" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-[0.14em] text-white">
                MOMENTUM AI
              </div>
              <div className="text-xs text-neutral-500">工业智能售前与报价系统</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-5 text-xs text-neutral-400 md:flex">
              <div className="flex items-center gap-2">
                <StatusDot />
                <span>系统可用</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot />
                <span>知识库已连接</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot />
                <span>报价规则已启用</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearRecords}
              disabled={isLoading}
              className="rounded-md border border-neutral-700 bg-[#171b22] px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空记录
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#333_transparent] lg:flex">
          <section className="rounded-lg border border-neutral-800 bg-[#111419] p-4">
            <div className="mb-4">
              <div className="text-xs font-medium text-neutral-500">售前工作流</div>
              <h2 className="mt-1 text-base font-semibold text-white">客户需求处理</h2>
            </div>

            <div className="space-y-3">
              {WORKFLOW_ITEMS.map((item, index) => (
                <div key={item.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-xs font-semibold text-neutral-300">
                      {index + 1}
                    </div>
                    {index < WORKFLOW_ITEMS.length - 1 && (
                      <div className="mt-2 h-7 w-px bg-neutral-800" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-100">{item.title}</div>
                    <div className="mt-0.5 text-xs leading-5 text-neutral-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-[#111419] p-4">
            <div className="text-xs font-medium text-neutral-500">服务能力</div>
            <h2 className="mt-1 text-base font-semibold text-white">售前支持范围</h2>

            <div className="mt-4 space-y-3">
              {SERVICE_MODULES.map((item) => (
                <div key={item.title} className="rounded-md border border-neutral-800 bg-[#151922] p-3">
                  <div className="text-sm font-semibold text-neutral-100">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{item.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="flex min-h-0 flex-col rounded-lg border border-neutral-800 bg-[#111419]">
          <div className="shrink-0 border-b border-neutral-800 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-semibold text-white">智能售前咨询</h1>
                <p className="mt-1 text-xs text-neutral-500">
                  输入设备、面积或工况需求，系统将生成参数说明、方案建议和预估报价。
                </p>
              </div>
              <div className="rounded-md border border-neutral-700 bg-[#171b22] px-3 py-2 text-xs text-neutral-400">
                当前咨询单
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const isLatestAssistant =
                  isLoading && message.role === "assistant" && index === messages.length - 1;

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-xs font-semibold text-white">
                        顾
                      </div>
                    )}

                    <article
                      className={`max-w-[92%] rounded-lg border p-4 sm:max-w-[82%] ${
                        isUser
                          ? "border-red-900/50 bg-red-950/20 text-neutral-100"
                          : "border-neutral-800 bg-[#171b22] text-neutral-200"
                      }`}
                    >
                      {!isUser && (
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            <span className="text-xs font-medium text-neutral-400">
                              智能售前顾问
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-600">
                            {isLatestAssistant ? "处理中" : "已回复"}
                          </span>
                        </div>
                      )}

                      <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-200">
                        {message.content}
                        {isLatestAssistant && (
                          <span className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 bg-red-500 animate-pulse" />
                        )}
                      </p>

                      {message.role === "assistant" &&
                        message.agentSteps &&
                        message.agentSteps.length > 0 && (
                          <div className="mt-4 rounded-md border border-neutral-800 bg-[#111419] p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-xs font-medium text-neutral-400">
                                处理进度
                              </span>
                              <span className="text-[10px] text-neutral-600">
                                {message.agentSteps.length} 项
                              </span>
                            </div>

                            <div className="space-y-2">
                              {message.agentSteps.map((step, stepIndex) => (
                                <div
                                  key={`${step.label}-${stepIndex}`}
                                  className="grid grid-cols-[14px_minmax(0,1fr)_54px] items-center gap-2 text-xs"
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      step.status === "completed"
                                        ? "bg-emerald-400"
                                        : "bg-neutral-500 animate-pulse"
                                    }`}
                                  />
                                  <span className="truncate text-neutral-400">{step.label}</span>
                                  <span className="text-right text-[10px] text-neutral-600">
                                    {step.status === "completed" ? "完成" : "处理中"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {!isLoading && message.uiComponent?.name === "ProductGallery" && (
                        <ProductGallery products={message.uiComponent.payload} />
                      )}

                      {!isLoading && message.uiComponent?.name === "QuoteResult" && (
                        <>
                          <QuoteTable quote={message.uiComponent.payload.quote} />
                          {message.uiComponent.payload.sources && (
                            <SourceList sources={message.uiComponent.payload.sources} />
                          )}
                          <ProductGallery products={message.uiComponent.payload.products} />
                        </>
                      )}
                    </article>

                    {isUser && (
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-800 text-xs font-semibold text-white">
                        客
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#333_transparent] xl:flex">
          <section className="rounded-lg border border-neutral-800 bg-[#111419] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-neutral-500">当前咨询单</div>
                <h2 className="mt-1 text-base font-semibold text-white">需求概览</h2>
              </div>
              <div className="rounded-md border border-neutral-700 bg-[#171b22] px-2 py-1 text-xs text-neutral-400">
                {isLoading ? "处理中" : "待跟进"}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-neutral-800 bg-[#151922] p-3">
                <div className="text-xs text-neutral-500">设备类型</div>
                <div className="mt-1 text-sm font-medium text-neutral-100">{consultation.device}</div>
              </div>
              <div className="rounded-md border border-neutral-800 bg-[#151922] p-3">
                <div className="text-xs text-neutral-500">面积信息</div>
                <div className="mt-1 text-sm font-medium text-neutral-100">{consultation.area}</div>
              </div>
              <div className="rounded-md border border-neutral-800 bg-[#151922] p-3">
                <div className="text-xs text-neutral-500">应用场景</div>
                <div className="mt-1 text-sm font-medium text-neutral-100">{consultation.scenario}</div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-neutral-800 bg-[#151922] p-3">
              <div className="text-xs font-medium text-neutral-400">下一步建议</div>
              <p className="mt-2 text-xs leading-6 text-neutral-500">
                如果报价信息不完整，请补充面积、设备类型或现场工况；如果已经报价，可继续询问推荐方案和参数依据。
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-800 bg-[#111419] p-4">
            <div className="text-xs font-medium text-neutral-500">售前资料</div>
            <h2 className="mt-1 text-base font-semibold text-white">可调用资料</h2>

            <div className="mt-4 space-y-3">
              {["产品参数手册", "工程报价规则", "方案推荐记录"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-neutral-800 bg-[#151922] p-3">
                  <span className="text-sm text-neutral-200">{item}</span>
                  <span className="text-xs text-emerald-400">可用</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-6 text-neutral-500">
              售前结果用于快速沟通与方案初筛，正式报价仍需结合现场勘察、运输距离和安装条件确认。
            </p>
          </section>
        </aside>
      </main>

      <footer className="shrink-0 border-t border-neutral-800 bg-[#101216] px-4 py-4">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSend(question)}
                disabled={isLoading}
                className="shrink-0 rounded-md border border-neutral-800 bg-[#171b22] px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-[#151922] px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-red-600 focus:ring-1 focus:ring-red-600 disabled:opacity-50"
              placeholder="输入设备类型、面积、场景或参数需求..."
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading}
              className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,0.22)] transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-7"
            >
              {isLoading ? "处理中" : "生成售前方案"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

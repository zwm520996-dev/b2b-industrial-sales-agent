"use client";

import React,{useState,useRef,useEffect} from "react";
import ProductGallery from '../components/ProductGallery';
import QuoteTable from '../components/QuoteTable';
import SourceList from '../components/SourceList';
import type { Product } from '../components/ProductGallery';
import type { QuotePayload } from '../components/QuoteTable';
import type { SourceItem } from '../components/SourceList';

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

const EXAMPLE_QUESTIONS = [
  "500平中央空调多少钱？",
  "中央空调多少钱？",
  "化工厂耐高温阀门有什么参数要求？",
  "300平车间推荐什么空调方案？",
];

function getSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const storageKey = "b2b-agent-session-id";
  const existingSessionId = window.localStorage.getItem(storageKey);

  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = crypto.randomUUID();
  window.localStorage.setItem(storageKey, newSessionId);
  return newSessionId;
}

//定义消息的数据结构
interface ChatMessage{
  role:'user'|'assistant';
  content:string;
  uiComponent?: AssistantComponent;
  agentSteps?: AgentStep[];
}

export default function Home(){
  //1、状态机：负责接管所有的对话数据
  const [messages,setMessages]=useState<ChatMessage[]>([
    {role:"assistant",content:"您好，我是本企业的智能售前顾问。请问您需要了解哪款设备的参数，或者核算哪种工程的报价？"}
  ]);

  const [inputValue,setInputValue]=useState('');
  const [isLoading,setIsLoading]=useState(false);
  const [sessionId] = useState(getSessionId);
  const [conversationSummary, setConversationSummary] = useState("");

  //自动滚动锚点
  const messagesEndRef=useRef<HTMLDivElement>(null);

  //每次消息更新，自动滚动到最底部
  const scrollToBottom=()=>{
    messagesEndRef.current?.scrollIntoView({behavior:"smooth"})
  }

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, isLoading]);

  //2、核心：发送请求并解析SSE字节流
  const handleSend = async (overrideMessage?: string) => {

    const messageToSend = overrideMessage ?? inputValue;

   if (!messageToSend.trim() || isLoading) return;

    const userQuery = messageToSend;
    
    //立即上屏用户的提问,并预留一个空的AI七宝等待打字机填充
    setMessages(prev=>[
      ...prev,
      {role:"user",content:userQuery},
      {role:"assistant",content:'', agentSteps: []}
    ])

    setInputValue('')
    setIsLoading(true);

    try{
      //发起POST请求，携带历史记录
      const response =await fetch(`${API_BASE_URL}/api/chat/stream`,{
        method:"POST",
        headers:{'Content-Type':"application/json"},
        body:JSON.stringify({
          message:userQuery,
          //剔除刚加进去的空AI消息，把之前的历史传给后端
          history:messages.map(m=>({role:m.role,content:m.content})),
          session_id: sessionId,
          summary: conversationSummary
        })
      });

      if(!response.body) throw new Error('ReadableStream not supported')

      //获取网络字节流读取器
      const reader=response.body.getReader();
      const decoder=new TextDecoder('utf-8')

      //无限循环读取流式数据包,直到读取完毕
      while(true){
        const {done,value}=await reader.read();
        if (done) break; //后端发出了结束信号，跳出循环

        //把字节解码成字符串
        const chunk=decoder.decode(value,{stream:true});
        const lines=chunk.split('\n'); //按行切分

        //暴力解析SSE协议
        for (const line of lines){
          if(line.startsWith('data:')){
            const dataStr=line.replace('data:','').trim()
            if(dataStr==='[DONE]') break //结束

            try{
             const dataObj = JSON.parse(dataStr) as {
                text?: string;
                type?: string;
                content?: string;
                label?: string;
                status?: AgentStep["status"];
                name?: AssistantComponent["name"];
                payload?: AssistantComponent["payload"];
              };
              if(dataObj.text){
                //核心:精准到最后一条AI消息，把新字动态追加进去！
                setMessages( prev => {
                  const newMessages=[...prev];
                  const lastIndex = newMessages.length - 1;
                  // 创建一个全新的对象来替换最后一个消息对象，而不是原地修改
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: newMessages[lastIndex].content + dataObj.text
                  };
                  return newMessages
                })
              };
              if (dataObj.type === "summary" && typeof dataObj.content === "string") {
                setConversationSummary(dataObj.content);
              };

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

            }catch(e){
              console.error("JSON 解析流数据碎片时出现异常:", e)
            }
          }
        }
      }
    }catch{
      setMessages(prev=>{
        const newMessages=[...prev];
        newMessages[newMessages.length-1].content="⚠️ 网络请求失败，请检查后端 FastAPI 服务是否正常启动。"
        return newMessages;
      })
    }finally{
      setIsLoading(false);
    }
  };

  //支持回车键发送
  const handleKeyDown=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==='Enter' && !e.nativeEvent.isComposing){
       handleSend();
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans flex flex-col">
      {/* 顶部导航栏 (保持不变) */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-red-600 rounded-sm flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.4)]">
              <div className="w-2 h-2 bg-neutral-950 rounded-full"></div>
            </div>
            <span className="text-lg font-bold tracking-widest text-white">
              MOMENTUM<span className="text-red-600">.</span>AI
            </span>
          </div>
          <div className="text-xs text-neutral-500 hidden sm:block font-mono">
            / 工业级智能售前系统 v1.0 /
          </div>
        </div>
      </header>

      {/* 核心对话区：通过状态机动态渲染 */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-6 overflow-y-auto pb-36">
        {messages.map((msg, index) => (
          <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* 头像 */}
            <div className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-1 shadow-md 
              ${msg.role === 'user' ? 'bg-neutral-700' : 'bg-red-600'}`}>
              {msg.role === 'user' ? '客' : 'AI'}
            </div>
            {/* 气泡 */}
            <div className={`border p-4 rounded-lg max-w-[90%] sm:max-w-[75%] shadow-lg 
              ${msg.role === 'user' 
                ? 'bg-red-900/10 border-red-900/30 rounded-tr-none text-neutral-100' 
                : 'bg-neutral-900 border-neutral-800 rounded-tl-none text-neutral-300'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {/* 悬停光标特效：如果是AI正在回答的最后一条消息，给个闪烁的光标 */}
                {msg.content}
                {isLoading && msg.role === 'assistant' && index === messages.length - 1 && (
                  <span className="inline-block w-2 h-4 ml-1 bg-red-600 animate-pulse"></span>
                )}
              </p>

              {msg.role === "assistant" && msg.agentSteps && msg.agentSteps.length > 0 && (
                <div className="mt-4 border-t border-neutral-800 pt-3">
                  <div className="mb-2 text-[11px] font-bold text-neutral-500 tracking-wide">
                    Agent 执行过程
                  </div>

                  <div className="space-y-2">
                    {msg.agentSteps.map((step, stepIndex) => (
                      <div key={`${step.label}-${stepIndex}`} className="flex items-center gap-2 text-xs">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            step.status === "completed" ? "bg-red-500" : "bg-neutral-500 animate-pulse"
                          }`}
                        />
                        <span className="text-neutral-400">{step.label}</span>
                        <span className="ml-auto font-mono text-[10px] text-neutral-600">
                          {step.status === "completed" ? "done" : "running"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day 10 测试：如果在最后一条 AI 消息（并且加载完毕），就渲染结构化卡片 */}
              {!isLoading && msg.uiComponent?.name === "ProductGallery" && (
                <ProductGallery products={msg.uiComponent.payload} />
              )}

              {!isLoading && msg.uiComponent?.name === "QuoteResult" && (
                <>
                  <QuoteTable quote={msg.uiComponent.payload.quote} />
                   {msg.uiComponent.payload.sources && (
                      <SourceList sources={msg.uiComponent.payload.sources} />
                    )}
                  <ProductGallery products={msg.uiComponent.payload.products} />
                </>
              )}
            </div>
          </div>
        ))}
        {/* 底部定位锚点 */}
        <div ref={messagesEndRef} />
      </main>

      {/* 底部输入框 */}
      <footer className="fixed bottom-0 w-full bg-neutral-950/90 backdrop-blur-md border-t border-neutral-800 p-4 z-50">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex flex-wrap gap-2 border-b border-neutral-900 pb-3">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSend(question)}
                disabled={isLoading}
                className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="max-w-4xl mx-auto flex gap-3 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all disabled:opacity-50"
              placeholder="输入设备型号或面积需求..."
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? '核算中...' : '核算'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );

};

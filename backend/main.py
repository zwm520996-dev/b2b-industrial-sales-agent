from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, TypedDict
import os
import json
import asyncio
import traceback
from dotenv import load_dotenv
from openai import OpenAI
from fastapi.responses import StreamingResponse

# 导入封装的语义检索函数
from rag_storage import query_knowledge

# 模拟从数据库或知识库查出来的真实设备数据
PRODUCT_RECOMMENDATIONS_BY_DEVICE = {
    "中央空调": [
        {
            "id": "ac-1",
            "name": "AC-MAX 工业中央空调系统",
            "specs": "制冷量 50kW / 适用 300-800㎡",
            "price": "¥450/㎡起",
            "highlights": ["大面积厂房", "节能变频"]
        },
        {
            "id": "ac-2",
            "name": "AC-PLUS 变频中央空调系统",
            "specs": "制冷量 35kW / 适用 200-500㎡",
            "price": "¥380/㎡起",
            "highlights": ["分区温控", "运行成本低"]
        },
        {
            "id": "ac-3",
            "name": "AC-PRO 精密恒温空调系统",
            "specs": "制冷量 25kW / 适用 100-300㎡",
            "price": "¥520/㎡起",
            "highlights": ["恒温控制", "异常告警"]
        }
    ],
    "管道": [
        {
            "id": "pipe-1",
            "name": "PIPE-800 耐腐蚀工业管道",
            "specs": "DN80 / 10MPa / 耐温 260℃",
            "price": "¥150/㎡起",
            "highlights": ["耐腐蚀", "化工输送"]
        },
        {
            "id": "pipe-2",
            "name": "PIPE-1200 高压蒸汽管道",
            "specs": "DN120 / 18MPa / 耐温 420℃",
            "price": "¥220/㎡起",
            "highlights": ["高压蒸汽", "热力工况"]
        }
    ],
    "高空阀门": [
        {
            "id": "valve-1",
            "name": "HG-901 不锈钢高空阀门",
            "specs": "16MPa / 耐温 450℃",
            "price": "¥800/㎡起",
            "highlights": ["耐腐蚀", "紧急切断"]
        },
        {
            "id": "valve-2",
            "name": "VALVE-X7 智能高空阀门",
            "specs": "20MPa / 耐温 500℃",
            "price": "¥980/㎡起",
            "highlights": ["远程控制", "状态反馈"]
        },
        {
            "id": "valve-3",
            "name": "VALVE-SAFE 紧急切断阀",
            "specs": "16MPa / 响应时间 <1s",
            "price": "¥760/㎡起",
            "highlights": ["安全联锁", "自动切断"]
        }
    ],
    "电气开关": [
        {
            "id": "switch-1",
            "name": "SP-300 智能电气开关柜",
            "specs": "10kV / 1250A",
            "price": "¥300/㎡起",
            "highlights": ["远程断电", "过载保护"]
        },
        {
            "id": "switch-2",
            "name": "SWITCH-PLUS 智能电气开关柜",
            "specs": "10kV / 1600A",
            "price": "¥360/㎡起",
            "highlights": ["温升监测", "远程分合闸"]
        },
        {
            "id": "switch-3",
            "name": "SWITCH-MINI 低压配电控制柜",
            "specs": "0.4kV / 630A",
            "price": "¥220/㎡起",
            "highlights": ["低压配电", "快速安装"]
        }
    ]
}

def get_recommended_products(device: str):
    return PRODUCT_RECOMMENDATIONS_BY_DEVICE.get(device, [])

load_dotenv()
SILICONFLOW_API_KEY = os.getenv("SILICONFLOW_API_KEY")
if not SILICONFLOW_API_KEY:
    raise ValueError("错误：未在 .env 文件中检测到 SILICONFLOW_API_KEY")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app = FastAPI(title='B2B Agent API', version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=SILICONFLOW_API_KEY, base_url="https://api.siliconflow.cn/v1")
CHAT_MODEL = "Qwen/Qwen2.5-14B-Instruct"

#history 超过 8 条消息时，触发摘要
#Supervisor 只保留最近 6 条原始消息
SUMMARY_TRIGGER_MESSAGES = 8
RECENT_HISTORY_LIMIT = 6


# ==================== Pydantic & LangGraph 类型定义 ====================
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: List[ChatMessage] = Field(default=[])
    session_id: str = Field(default="default_session")
    summary: str = Field(default="")

# 定义 LangGraph 通信的全局状态网 (State)
class AgentState(TypedDict):
    user_query: str              # 用户当前的提问
    history: List[Dict[str, str]] # 多轮历史记忆
    summary: str
    updated_summary: str
    retrieved_context: str       # RAG 检索出来的上下文
    retrieved_sources: List[Dict[str, Any]]
    next_node: str               # 下一步去往哪个节点的信号灯
    final_reply: str             # 最终准备返回给前端的文本
    # 💡 新增：用来在节点间流转的组件数据包
    response_component: Optional[Dict[str, Any]]
    quote_params: Optional[Dict[str, Any]]


def summarize_history(
    previous_summary: str,
    history: List[Dict[str, str]],
    current_query: str
) -> str:
    """当对话历史过长时，将旧摘要和最近对话压缩成新的长期记忆"""
    if len(history) <= SUMMARY_TRIGGER_MESSAGES:
        return previous_summary

    recent_history = history[-RECENT_HISTORY_LIMIT:]

    history_text = "\n".join(
        f"{item.get('role', 'unknown')}: {item.get('content', '')}"
        for item in recent_history
        if item.get("content")
    )

    system_prompt = f"""你是一个对话记忆压缩器，负责为 B2B 工业售前 Agent 维护长期对话摘要。

请基于旧摘要、最近对话和当前用户问题，生成一段新的长期摘要。

旧摘要：
{previous_summary or "暂无"}

最近对话：
{history_text}

当前用户问题：
{current_query}

要求：
1. 保留客户正在咨询的设备类型、面积、预算、工况、偏好和已经确认的信息。
2. 删除寒暄、重复话术和无关内容。
3. 不要编造用户没有提供的信息。
4. 控制在 180 字以内。
5. 直接输出摘要文本，不要使用 Markdown。
"""

    try:
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "system", "content": system_prompt}],
            temperature=0.1,
            timeout=10.0
        )
        return response.choices[0].message.content or previous_summary
    except Exception as e:
        print(f"历史摘要生成失败: {type(e).__name__}: {repr(e)}")
        return previous_summary


# ==================== LangGraph 节点（Nodes）独立解耦 ====================
def rag_retrieval_node(state: AgentState) -> Dict[str, Any]:
    """优化版 RAG 检索节点，引入多轮感知与 Token 瘦身机制"""
    print("\n[LangGraph 节点运行]: -> 激活高精 RAG 检索与 Token 优化节点")

    user_query=state["user_query"]
    history=state.get("history",[])

    #[Token优化策略1]：构建多轮感知的复合检索词
    # 如果有历史对话，把最近一轮的对话关键词融合进来，确保检索不会因为客户说“那 800 平米呢”而脱靶
    search_query=user_query
    if history:
        last_reply=history[-1].get("content","")
        #提取上一轮的简要关键词辅助检索
        search_query=f"{last_reply[:20]}{user_query}"

    #执行向量检索
    rag_result = query_knowledge(search_query)

    raw_context = rag_result.get("context", "")
    retrieved_sources = rag_result.get("sources", [])

    #[Token优化策略2]：脱水瘦身
    # 很多时候向量数据库捞出来的段落有大量重复的空行、页眉页脚或冗余废话
    # 我们在传入大模型前，进行严格的去重和结构化截断，只保留前 1000 个核心 Token 字符
    cleaned_lines=[]
    seen=set()
    for line in raw_context.split("\n"):
        line_stripped=line.strip()
        if line_stripped and line_stripped not in seen:
            seen.add(line_stripped)
            cleaned_lines.append(line_stripped)

    #只把脱水后的高浓度上下文喂给大模型，单次能省下 30%~50% 的无效 Token 消耗！
    compressed_context="\n".join(cleaned_lines)[:1000]

    print(f"[Token 优化器]: 原始上下文长度 {len(raw_context)} 字 -> 瘦身压缩至 {len(compressed_context)} 字")

    return {
        "retrieved_context": compressed_context,
        "retrieved_sources": retrieved_sources
    }
    
def supervisor_routing_node(state: AgentState) -> Dict[str, Any]:
    """节点2：意图规划与路由决策中心（第一次思考）"""
    print("[LangGraph 节点运行]: -> 激活 Supervisor 路由决策节点")

    system_prompt = f"""你是一名专业的 B2B 工业售前顾问专家。
[企业核心知识库]:
{state['retrieved_context']}

你需要判断用户意图，并只输出 JSON，不要输出 Markdown，不要输出解释文字。

JSON 格式必须是：
{{
  "intent": "quote 或 knowledge",
  "device": "管道/中央空调/电气开关/高空阀门/null",
  "area": 数字或 null,
  "reply": "如果缺少参数或普通知识问答，在这里写给用户的回复；如果参数齐全准备调用工具，这里留空字符串"
}}

规则：
1. 如果用户询问价格、多少钱、造价、预算、报价，intent 必须是 "quote"。
2. 报价只需要两个参数：device 和 area。
3. device 只能是：管道、中央空调、电气开关、高空阀门。
4. 如果用户提到了设备类型，就填入 device，不要追问型号。
5. 如果用户提到了面积，例如 500平、500平方米、500㎡，就提取数字到 area。
6. 如果报价参数齐全，reply 必须是空字符串。
7. 如果缺少设备类型或面积，intent 仍然是 "quote"，但 reply 要礼貌反问缺失参数。
8. 如果是普通产品参数问答，intent 是 "knowledge"，device 和 area 都为 null，reply 直接基于知识库回答。
"""

    messages = [{"role": "system", "content": system_prompt}]

    if state.get("summary"):
        messages.append({
            "role": "system",
            "content": f"[长期对话摘要]\n{state['summary']}"
        })

    recent_history = state["history"][-RECENT_HISTORY_LIMIT:]
    for h in recent_history :
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": state["user_query"]})

    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.1,
        timeout=10.0
    )
    ai_decision = response.choices[0].message.content or ""

    # if "TRIGGER_TOOL" in ai_decision:
    #     return {"next_node": "execute_tool", "final_reply": ai_decision}
    # else:
    #     return {"next_node": "end", "final_reply": ai_decision}

    try:
        json_start=ai_decision.find("{")
        json_end=ai_decision.find("}")

        if json_start==-1 or json_end==-1:
            raise ValueError("模型未返回JSON")

        decision=json.loads(ai_decision[json_start:json_end+1])

        intent=decision.get("intent")
        device=decision.get("device")
        area=decision.get("area")
        reply=decision.get("reply","")

        if intent=="quote" and device and area:
            return{
                "next_node": "execute_tool",
                "quote_params": {
                    "device": device,
                    "area": float(area)
                },
                 "final_reply": ""
            }

        return {
            "next_node": "end",
            "final_reply": reply or "为了继续为您核算方案，请补充设备类型和厂房面积。",
            "quote_params": None
        }

    except Exception as e:
        print(f"Supervisor JSON 解析失败: {e}; 原始输出: {ai_decision}")
        return {
            "next_node": "end",
            "final_reply": "我需要确认两个信息后才能继续核算：您需要哪类设备，以及厂房面积大约是多少平方米？",
            "quote_params": None
        }




def tool_execution_node(state: AgentState) -> Dict[str, Any]:
    """节点3：专门负责调用 Python 计算器进行严谨物理核算"""
    print("[LangGraph 节点运行]: -> 激活 Tool 物理计算节点")
    # raw_decision = state["final_reply"]
    # device = "中央空调"  
    # area = 500
    # if "面积=" in raw_decision:
    #     try:
    #         area = float(raw_decision.split("面积=")[1].split(",")[0].strip())
    #         device = raw_decision.split("设备=")[1].split(",")[0].strip()
    #     except:
    #         pass

    quote_params=state.get("quote_params") or {}
    device=quote_params.get("device")
    area=quote_params.get("area")

    if not device or not area:
        return{
            "final_reply": "为了给您核算报价，请补充设备类型和厂房面积。",
            "response_component": None,
            "next_node": "end"
        }
    
    area = float(area)

    base_price_map = {"管道": 150, "中央空调": 450, "电气开关": 300, "高空閥門": 800, "高空阀门": 800}
    unit_price = base_price_map.get(device, 450)
    total_cost = area * unit_price

    tool_result_str = f"经 system 严谨核算：您所需的【{device}】方案，单价为 {unit_price} 元/㎡，工程总造价预计为 {total_cost} 元。"

    system_prompt = f"""你是一名专业的 B2B 工业售前顾问。
请基于下方工具核算结果，回复客户一段简洁、自然的在线咨询话术。

工具核算结果：
{tool_result_str}

要求：
1. 不要写邮件格式。
2. 不要出现“尊敬的客户”“祝商祺”“您的名字”“联系方式”等模板化内容。
3. 不要虚构额外参数。
4. 控制在 120 字以内。
5. 明确说明该报价是预估报价，最终需结合现场工况确认。
"""
    # response = client.chat.completions.create(
    #     model=CHAT_MODEL,
    #     messages=[{"role": "system", "content": system_prompt}],
    #     temperature=0.3,
    #     timeout=10.0
    # )

    final_reply = (
        f"您好，根据我们的核算，您所需的{device}方案单价为{unit_price}元/㎡，"
        f"工程总造价预计为{total_cost:,.0f}元。请注意，此报价为预估价格，"
        f"最终价格需结合现场工况、安装距离和品牌配置进一步确认。"
    )

    component_data = {
        "type": "ui_component",
        "name": "QuoteResult",
        "payload": {
            "quote": {
                "device": device,
                "area": area,
                "unitPrice": unit_price,
                "totalCost": total_cost
            },
            "sources": state.get("retrieved_sources", []),
            "products": get_recommended_products(device)
        }
    }
    
    # return {"final_reply": response.choices[0].message.content,"response_component": component_data, "next_node": "end"}

    return {
        "final_reply": final_reply,
        "response_component": component_data,
        "next_node": "end"
    }

# LangGraph 边流转控制逻辑 (Conditional Edges)
from langgraph.graph import StateGraph, END
#引入内存保存器(短期记忆)
from langgraph.checkpoint.memory import MemorySaver

# 创建记忆实例
memory = MemorySaver()

def route_decision(state: AgentState):
    """根据决策节点的信号灯，分流到不同执行路径"""
    if state["next_node"] == "execute_tool":
        return "execute_tool"
    return END

def sse_payload(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

def chunk_text(text: str, size: int = 6):
    for index in range(0, len(text), size):
        yield text[index:index + size]


# 在流式输出文本循环结束后，判断是否触发了设备推荐逻辑
async def generate_chat_stream(request:ChatRequest):
    welcome_text="根据您的需求，售前系统已为您精准检索出以下核心中央空调设备方案:"
    for char in welcome_text:
        yield f"data:{json.dump({'text':char,'type':'message'})}\n\n"
        await asyncio.sleep(0.02)

    #核心：文字吐完后，立刻在同一个通道里推送UT组件数据包！
    ui_payload = {
        "type": "ui_component",
        "name": "ProductGallery",
        "payload": REAL_DATABASE_PRODUCTS
    }
    yield f"data: {json.dumps(ui_payload)}\n\n"
    yield "data: [DONE]\n\n"


workflow = StateGraph(AgentState)
workflow.add_node("rag_retrieval", rag_retrieval_node)
workflow.add_node("supervisor_router", supervisor_routing_node)
workflow.add_node("execute_tool", tool_execution_node)

# 确立流转逻辑（修正入口名字对齐）
workflow.set_entry_point("rag_retrieval")
workflow.add_edge("rag_retrieval", "supervisor_router")
workflow.add_conditional_edges(
    "supervisor_router",
    route_decision,
    {
        "execute_tool": "execute_tool",
        END: END
    }
)

workflow.add_edge("execute_tool", END)
compile_agent = workflow.compile(checkpointer=memory)

# ==================== 🏁 FastAPI SSE (流式打字机) 路由接口 ====================

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    闭环：LangGraph 状态机驱动的 SSE 流式打字机输出接口（带双轨制数据包）
    """
    history_list = [{"role": h.role, "content": h.content} for h in request.history]

    updated_summary = summarize_history(
        previous_summary=request.summary,
        history=history_list,
        current_query=request.message
    )

    async def sse_event_generator():
        try:
            print("\n=== LangGraph 状态机引擎正式启动 ===")
            inputs = {
                "user_query": request.message,
                "history": history_list,
                "summary": updated_summary,
                "updated_summary": updated_summary,
                "retrieved_context": "",
                "retrieved_sources": [],
                "next_node": "",
                "final_reply": "",
                "response_component": None,
                "quote_params": None
            }

            config = {
                "configurable": {
                    "thread_id": request.session_id
                }
            }

            loop = asyncio.get_event_loop()
            output_state = await loop.run_in_executor(None, lambda: compile_agent.invoke(inputs,config=config))

            full_reply = output_state["final_reply"]
            ui_component = output_state.get("response_component")
            output_summary  = output_state.get("updated_summary", "")

            if output_summary :
                yield sse_payload({
                    "type": "summary",
                    "content": output_summary 
                })
                print(f"[历史摘要]: 当前摘要长度 {len(output_summary )} 字")

            agent_steps = [
                {"type": "agent_step", "label": "知识库检索", "status": "completed"},
                {"type": "agent_step", "label": "意图识别", "status": "completed"},
            ]

            if output_state.get("quote_params"):
                agent_steps.extend([
                    {"type": "agent_step", "label": "报价参数抽取", "status": "completed"},
                    {"type": "agent_step", "label": "报价工具调用", "status": "completed"},
                ])

            if ui_component:
                agent_steps.append(
                    {"type": "agent_step", "label": "结构化方案生成", "status": "completed"}
                )

            for step in agent_steps:
                yield sse_payload(step)
                await asyncio.sleep(0.08)

            # 轨道 A：先流式吐出普通大模型润色文本（带type属性，以便前端精准识别）
            for chunk in chunk_text(full_reply, size=6):
                payload = {"text": chunk, "type": "message"}
                yield sse_payload(payload)
                await asyncio.sleep(0.003)

            # 💡 【核心救场】：文字吐完后，判断是否属于中央空调等产品推荐流程。
            # 为了完成 Day 11 闭环，我们在最后无缝追轨发送结构化 UI 数据包！
            if ui_component:
                print(f"[SSE 自动化发包]: 捕获到来自 LangGraph 节点的组件数据 [{ui_component['name']}]，正在追加推送...")
                yield sse_payload(ui_component)

            # 最终结束信号
            yield "data: [DONE]\n\n" 
            print("=== LangGraph 图数据流全部处理完毕，SSE 成功闭环 ===")

        except Exception as e:
            print(f"SSE 管道流出故障: {type(e).__name__}: {repr(e)}")
            traceback.print_exc()
            yield sse_payload({'text': '系统繁忙，请稍后再试。', 'type': 'message'})
            yield "data: [DONE]\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")



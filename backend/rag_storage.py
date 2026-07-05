import os
from dotenv import load_dotenv
from textwrap import wrap
from openai import OpenAI
import chromadb

# 自动寻找并加载当前目录下的 .env 文件
load_dotenv()

#从环境变量中动态读取密钥，如果找不到则提报错提示
SILICONFLOW_API_KEY=os.getenv("SILICONFLOW_API_KEY")

if not SILICONFLOW_API_KEY:
    raise ValueError("错误：未在 .env 文件中检测到 SILICONFLOW_API_KEY，请检查配置文件！")

# 初始化标准 OpenAI 客户端（指向硅基流动高速网关）
client = OpenAI(
    api_key=SILICONFLOW_API_KEY,
    base_url="https://api.siliconflow.cn/v1"
)


# 硅基流动平台提供的超强中文向量模型
MODEL_NAME = "BAAI/bge-large-zh-v1.5"
DB_DIR=os.path.join(os.path.dirname(__file__),"chroma_db")


def get_embedding(text:str):
    """纯手工调用：将单段文本转化为高维向量"""
    response=client.embeddings.create(
        model=MODEL_NAME,
        input=text
    )

    return response.data[0].embedding

def init_vector_db():
    """读取工业手册，切块并灌入向量数据库"""
    manual_path=os.path.join(os.path.dirname(__file__),"data","industrial_manual.txt")

    if not os.path.exists(manual_path):
       print("错误：未找到测试数据文件！")
       return

    with open(manual_path,"r",encoding="utf-8") as f:
        raw_text=f.read()

    #简易而严谨的切块逻辑：按段落切分
    chunks=[c.strip() for c in raw_text.split("\n\n") if c.strip()]
    print(f"成功将产品手册切分为 {len(chunks)} 个语义文本块。")

    #初始化纯净的本地Chroma客户端
    chroma_client=chromadb.PersistentClient(path=DB_DIR)

    #创建或获取一个名为"industrial_products"的向量集合
    collection=chroma_client.get_or_create_collection(name="industrial_products")
    print("正在计算向量并写入 ChromaDB（纯手工标准底层流）...")

    for i,chunk in enumerate(chunks):
        embedding=get_embedding(chunk)

        #写入数据库
        collection.add(
            embeddings=[embedding],
            documents=[chunk],
            ids=[f"doc_chunk_{i}"]
        )
    print("向量数据库构建成功并已本地持久化！")
    

def query_knowledge(user_query: str, n_results: int = 3):
    """根据用户提问，检索最相关的工业参数，并返回上下文和引用来源"""
    chroma_client = chromadb.PersistentClient(path=DB_DIR)
    collection = chroma_client.get_collection(name="industrial_products")

    query_embedding = get_embedding(user_query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
    )

    documents = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]

    sources = []
    context_blocks = []

    for index, document in enumerate(documents):
        if not document:
            continue

        distance = distances[index] if index < len(distances) else None

        title = document.split("\n")[0].replace("产品型号：", "").strip()
        snippet = document.replace("\n", " ")[:160]

        sources.append({
            "title": title,
            "snippet": snippet,
            "score": None if distance is None else round(1 / (1 + distance), 4),
        })

        context_blocks.append(f"[资料{index + 1}] {document}")

    if not context_blocks:
        return {
            "context": "未在企业知识库中检索到相关产品参数。",
            "sources": []
        }

    return {
        "context": "\n\n".join(context_blocks),
        "sources": sources
    }



if __name__ == "__main__":
    # 初始化
    init_vector_db()
    #测试检索
    print("\n--- 自动化检索测试 ---")
    test_query="化工厂耐高温的阀门指标是多少"
    print(f"用户提问: {test_query}")
    matched_result = query_knowledge(test_query)
    print(f"检索上下文:\n{matched_result['context']}")
    print("\n引用来源:")
    for source in matched_result["sources"]:
        print(f"- {source['title']} | score={source['score']}")

import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";

// 创建输出解析器
const parser = new StringOutputParser();

// 创建通义千问模型实例
const model = new ChatAlibabaTongyi({
  model: "qwen-max",
  alibabaApiKey: process.env.API_KEY,
});

// 创建提示模板
const prompt = PromptTemplate.fromTemplate(
  "我邻居姓：{lastname}，刚生了{gender}，请起名，仅告知我名字无需其它内容。",
);

// 创建链式结构
const chain = prompt.pipe(model).pipe(parser).pipe(model).pipe(parser);

// 调用链式结构
async function run() {
  const res = await chain.invoke({ lastname: "张", gender: "女儿" });
  console.log(res);
  console.log(typeof res);
}

// 执行函数
run();

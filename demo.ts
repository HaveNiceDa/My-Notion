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

/**
async function main() {
  const response = await openai.chat.completions.create({
    model: "qwen3.6-plus",  // 此处以qwen3.6-plus为例，可按需更换模型名称。模型列表：https://help.aliyun.com/zh/model-studio/models
    messages: [
      {
        role: "user",
        content: [{
            type: "image_url",
            image_url: {
              "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"
            }
          },
          {
            type: "text",
            text: "图中描绘的是什么景象?"
          }
        ]
      }
    ]
  });
  console.log(response.choices[0].message.content);
}
   */
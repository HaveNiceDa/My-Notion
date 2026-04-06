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
import OpenAI from 'openai';  
  
// 初始化客户端  
const openai = new OpenAI({  
  // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
  // 各地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
  apiKey: process.env.DASHSCOPE_API_KEY,  
  // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",  
});  
  
// 定义工具列表  
const tools = [  
  {  
    type: "function",  
    function: {  
      name: "get_current_weather",  
      description: "当你想查询指定城市的天气时非常有用。",  
      parameters: {  
        type: "object",  
        properties: {  
          location: {  
            type: "string",  
            description: "城市或县区，比如北京市、杭州市、余杭区等。",  
          },  
        },  
        required: ["location"],  
      },  
    },  
  },  
];  
  
// 模拟天气查询工具  
const getCurrentWeather = (args) => {  
  const weatherConditions = ["晴天", "多云", "雨天"];  
  const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];  
  const location = args.location;  
  return `${location}今天是${randomWeather}。`;  
};  
  
// 封装模型响应函数  
const getResponse = async (messages) => {  
  const response = await openai.chat.completions.create({  
    model: "qwen3.6-plus",  
    enable_thinking: false,
    messages: messages,  
    tools: tools,  
  });  
  return response;  
};  

const main = async () => {  
  const input = "北京天气咋样";

  let messages = [  
    {  
      role: "user",  
      content: input,  
    }  
  ];  
  let response = await getResponse(messages);  
  let assistantOutput = response.choices[0].message;  
  // 确保 content 不是 null  
  if (!assistantOutput.content) assistantOutput.content = "";  
  messages.push(assistantOutput);  
  // 判断是否需要调用工具  
  if (!assistantOutput.tool_calls) {  
    console.log(`无需调用天气查询工具，直接回复：${assistantOutput.content}`);  
  } else {  
    // 进入工具调用循环  
    while (assistantOutput.tool_calls) {  
      const toolCall = assistantOutput.tool_calls[0];  
      const toolCallId = toolCall.id;  
      const funcName = toolCall.function.name;  
      const funcArgs = JSON.parse(toolCall.function.arguments);  
      console.log(`正在调用工具 [${funcName}]，参数：`, funcArgs);  
      // 执行工具  
      const toolResult = getCurrentWeather(funcArgs);  
      // 构造工具返回信息  
      const toolMessage = {  
        role: "tool",  
        tool_call_id: toolCallId,  
        content: toolResult,  
      };  
      console.log(`工具返回：${toolMessage.content}`);  
      messages.push(toolMessage);  
      // 再次调用模型获取自然语言总结  
      response = await getResponse(messages);  
      assistantOutput = response.choices[0].message;  
      if (!assistantOutput.content) assistantOutput.content = "";  
      messages.push(assistantOutput);  
    }  
    console.log(`助手最终回复：${assistantOutput.content}`);  
  }  
};  
  
// 启动程序  
main().catch(console.error);
 */
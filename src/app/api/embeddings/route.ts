import { NextRequest, NextResponse } from 'next/server';
import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi';

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    
    if (!input) {
      return NextResponse.json(
        { error: 'Missing input' },
        { status: 400 }
      );
    }
    
    // 初始化通义千问embeddings
    const embeddings = new AlibabaTongyiEmbeddings({
      modelName: 'text-embedding-v2',
      apiKey: process.env.LLM_API_KEY || 'sk-69c8bba23c1b4226b11d3d00c14a6f79',
    });
    
    // 生成嵌入
    const embedding = await embeddings.embedQuery(input);
    
    return NextResponse.json({ embedding });
  } catch (error) {
    console.error('Error in embeddings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

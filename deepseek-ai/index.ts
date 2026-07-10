// Supabase Edge Function: deepseek-ai
// 代理 DeepSeek API 调用

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    const { action, payload } = await req.json();
    let systemPrompt = "";
    let userPrompt = "";

    if (action === "audit") {
      // 商机管线审计
      const opps = payload.opportunities || [];
      const oppsText = opps.map((o, i) =>
        `${i + 1}. ${o.name} | 客户:${o.client} | 金额:${o.amount}万 | 阶段:${o.stage} | 评分:${JSON.stringify(o.scores)} | 风险:${JSON.stringify(o.risks)}`
      ).join("\n");

      systemPrompt = `你是一个B2B销售管线审计专家。分析以下商机数据，给出JSON格式的报告。只返回JSON，不要其他文字。`;
      userPrompt = `分析以下商机管线数据，返回JSON报告，格式必须严格如下：
{
  "overview": {"activeCount": 数字, "totalValue": "¥X万", "qualityPct": "X%"},
  "risks": [{"name": "商机名", "level": "high/medium", "reasons": ["原因1","原因2"]}],
  "priority": [{"name": "商机名", "reason": "建议理由"}],
  "fixes": [{"name": "商机名", "action": "纠偏建议"}]
}

商机数据：
${oppsText}`;
    } else if (action === "client-research") {
      // 客户背景智搜
      const { company, industry, region, contactPerson } = payload;
      systemPrompt = `你是一个企业商业情报分析专家。根据提供的客户信息，生成结构化的企业背景报告。只返回JSON，不要其他文字。`;
      userPrompt = `请分析以下客户，返回JSON格式报告：
{
  "background": "企业背景介绍（100-200字）",
  "strategy": "战略动态和发展方向（100-200字）",
  "digitalNeeds": "数字化转型需求和痛点（100-200字）",
  "contactAnalysis": "对接人分析及沟通建议（100-200字）"
}

客户信息：
- 公司：${company}
- 行业：${industry || "未知"}
- 地区：${region || "未知"}
- 对接人：${contactPerson || "未知"}`;
    } else {
      return new Response(JSON.stringify({ error: "未知操作" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = typeof DEEPSEEK_API_KEY !== 'undefined' ? DEEPSEEK_API_KEY : Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DeepSeek API Key 未配置" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dsRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      return new Response(JSON.stringify({ error: `DeepSeek API 错误: ${dsRes.status}` }), {
        status: dsRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dsData = await dsRes.json();
    const content = dsData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "DeepSeek 返回为空" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the JSON result from DeepSeek
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { result: content };
    }

    return new Response(JSON.stringify({ result }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

// Vercel Edge Function: deepseek-ai
// 代理 DeepSeek API 调用
export const config = { runtime: "edge" };

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

export default async function handler(req) {
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
      const { company, industry, region, contactPerson } = payload;
      systemPrompt = `你是一个严谨的企业商业情报分析专家。只基于公开可验证的官方资料和权威新闻报道进行分析。如果某项信息无法从公开渠道确认，请明确注明"未找到相关公开信息"，严禁编造或推测。只返回JSON。`;
      userPrompt = `请基于公开资料分析以下企业，返回JSON格式报告。信息必须来源于官方网站、年报、权威财经媒体等可验证渠道：
{
  "background": "企业背景介绍（100-200字，包含主营业务、规模、行业地位，需源自官方或权威来源）",
  "strategy": "战略动态和发展方向（100-200字，包含近期战略举措、投资动向、市场布局，需源自公开新闻或公告）"
}

客户信息：
- 公司：${company}
- 行业：${industry || "未知"}
- 地区：${region || "未知"}`;
    } else {
      return new Response(JSON.stringify({ error: "未知操作" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY 未配置" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dsRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
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
}

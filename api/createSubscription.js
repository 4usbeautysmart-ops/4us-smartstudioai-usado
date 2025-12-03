import { MercadoPagoConfig, PreApproval } from "mercadopago";

export default async function handler(req, res) {
  console.log("---- CHEGOU NA API VITE/Vercel -----");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  let body = req.body;

  // Vercel às vezes não parseia JSON automaticamente
  // então garantimos que body exista
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "JSON inválido no body." });
    }
  }

  const { userId, userEmail, planType } = body;

  if (!userId || !userEmail || !planType) {
    return res.status(400).json({ error: "Dados insuficientes." });
  }

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    console.log("❌ MP_ACCESS_TOKEN não configurado");
    return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado." });
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
    });

    const preApproval = new PreApproval(client);

    // Criar assinatura recorrente mensal
    const resposta = await preApproval.create({
      body: {
        reason: "Plano Mensal PRO - 4us! Smart Studio AI",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 279,
          currency_id: "BRL",
          start_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Inicia após 48h (fim do trial)
        },
        payer_email: userEmail,
        external_reference: userId,
        back_url: `${process.env.APP_URL || "https://engenharia-de-cortes-5d.vercel.app"}/`,
        status: "pending",
        metadata: {
          userId: userId,
          planType: planType,
        },
      },
    });

    console.log("PreApproval criada:", resposta.init_point);

    return res.status(200).json({
      checkoutUrl: resposta.init_point,
      preapprovalId: resposta.id,
    });
  } catch (err) {
    console.log("🔥 Erro Mercado Pago:", err);
    return res.status(500).json({ error: "Falha ao criar assinatura: " + (err.message || "Erro desconhecido") });
  }
}

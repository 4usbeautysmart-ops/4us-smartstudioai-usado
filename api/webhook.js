import { MercadoPagoConfig, PreApproval, Payment } from "mercadopago";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFbOJd-wFo0yC5CCRPsexDkbAxjG1sRzs",
  authDomain: "us-smart-studio.firebaseapp.com",
  projectId: "us-smart-studio",
  storageBucket: "us-smart-studio.firebasestorage.app",
  messagingSenderId: "331682154208",
  appId: "1:331682154208:web:4f7f2cf9b144dab4a43285",
};

if (!getApps().length) initializeApp(firebaseConfig);
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    console.log("📩 Webhook recebido:", JSON.stringify(req.body, null, 2));

    const { type, data } = req.body;

    // 🔐 Conecta Mercado Pago
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
    });

    // Processar eventos de assinatura (PreApproval)
    if (type === "subscription_preapproval" || type === "preapproval") {
      const preapprovalId = data.id;
      if (!preapprovalId) {
        console.log("❌ Webhook sem preapprovalId");
        return res.status(400).json({ error: "preapprovalId ausente" });
      }

      const preApproval = new PreApproval(client);
      const preapprovalInfo = await preApproval.get({ id: preapprovalId });

      console.log("📋 Assinatura consultada:", preapprovalInfo);

      // Obter userId do external_reference ou metadata
      const userId =
        preapprovalInfo.external_reference || preapprovalInfo.metadata?.userId;

      if (!userId) {
        console.log("❌ Assinatura sem userId");
        return res.status(400).json({ error: "userId ausente" });
      }

      // Verificar status da assinatura
      if (preapprovalInfo.status === "authorized") {
        // Assinatura autorizada - calcular expiração (30 dias a partir de agora)
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
        const ref = doc(db, "users", userId);

        await updateDoc(ref, {
          subscriptionStatus: "active",
          paymentId: preapprovalId,
          accessUntil: expiresAt,
          updatedAt: serverTimestamp(),
        });

        console.log(
          `✅ Assinatura ativada para usuário ${userId} até ${new Date(
            expiresAt
          )}`
        );
      } else if (
        preapprovalInfo.status === "paused" ||
        preapprovalInfo.status === "cancelled"
      ) {
        // Assinatura pausada ou cancelada
        const ref = doc(db, "users", userId);
        const userDoc = await getDoc(ref);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Manter o accessUntil atual, mas marcar como expirado se já passou
          const now = Date.now();
          const accessUntil = userData.accessUntil || 0;

          if (now >= accessUntil) {
            await updateDoc(ref, {
              subscriptionStatus: "expired",
              updatedAt: serverTimestamp(),
            });
            console.log(
              `⚠️ Assinatura ${preapprovalInfo.status} para usuário ${userId}`
            );
          }
        }
      }

      return res.status(200).json({ success: true });
    }

    // Processar eventos de pagamento recorrente
    if (type === "payment") {
      const paymentId = data.id;
      if (!paymentId) {
        console.log("❌ Webhook sem paymentId");
        return res.status(400).json({ error: "paymentId ausente" });
      }

      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId });

      console.log("💰 Pagamento consultado:", paymentInfo);

      // Processar apenas pagamentos aprovados
      if (paymentInfo.status !== "approved") {
        console.log("Pagamento não aprovado:", paymentInfo.status);
        return res.status(200).json({ message: "Pagamento ignorado" });
      }

      // Buscar o preapproval_id do pagamento
      const preapprovalId = paymentInfo.preapproval_id;
      if (!preapprovalId) {
        console.log(
          "⚠️ Pagamento sem preapproval_id - pode ser pagamento único"
        );
        return res.status(200).json({ message: "Pagamento único ignorado" });
      }

      // Buscar informações da assinatura
      const preApproval = new PreApproval(client);
      const preapprovalInfo = await preApproval.get({ id: preapprovalId });

      const userId =
        preapprovalInfo.external_reference || preapprovalInfo.metadata?.userId;

      if (!userId) {
        console.log("❌ Assinatura sem userId");
        return res.status(400).json({ error: "userId ausente" });
      }

      // Renovar acesso por mais 30 dias
      const ref = doc(db, "users", userId);
      const userDoc = await getDoc(ref);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Se já tem acesso válido, adicionar 30 dias. Senão, começar de agora
        const currentAccessUntil = userData.accessUntil || Date.now();
        const newAccessUntil =
          Math.max(currentAccessUntil, Date.now()) + 30 * 24 * 60 * 60 * 1000;

        await updateDoc(ref, {
          subscriptionStatus: "active",
          accessUntil: newAccessUntil,
          updatedAt: serverTimestamp(),
        });

        console.log(
          `✅ Pagamento recorrente processado. Acesso renovado para usuário ${userId} até ${new Date(
            newAccessUntil
          )}`
        );
      }

      return res.status(200).json({ success: true });
    }

    // Ignorar outros tipos de eventos
    console.log("Ignorando evento:", type);
    return res.status(200).json({ status: "ignored", type });
  } catch (error) {
    console.error("🔥 Erro no webhook:", error);
    return res
      .status(500)
      .json({ error: "Erro interno no webhook: " + error.message });
  }
}

import React, { useState, useEffect } from "react";
import { getCurrentUser } from "../services/authService";
import { getUserData } from "../services/authService";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

interface SubscriptionProps {
  onSubscriptionSuccess?: () => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onSubscriptionSuccess }) => {
  const [processing, setProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  

  useEffect(() => {
    // Obter dados do usuário atual
    const user = getCurrentUser();
    if (user) {
      setUserEmail(user.email || "");
      getUserData(user.uid).then((data) => {
        if (data) {
          setUserName(data.fullName);
        }
      });
    }
  }, []);

  useEffect(() => {
    // Listener do Firestore para detectar atualizações do webhook
    // Quando o webhook atualizar o documento do usuário (por ex. subscriptionStatus -> 'active'),
    // redirecionamos ou chamamos `onSubscriptionSuccess`.
    const user = getCurrentUser();
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as any;

      const isActive = data?.subscriptionStatus === "active";
      const hasAccessUntil = typeof data?.accessUntil === "number" && data.accessUntil > Date.now();

      if (isActive || hasAccessUntil) {
        // Chama callback se fornecido
        if (onSubscriptionSuccess) {
          onSubscriptionSuccess();
        }

        // Também emitir evento global para que o App (ou outro) possa reagir
        try {
          window.dispatchEvent(new CustomEvent('subscription_success', { detail: { userId: user.uid } }));
          // Atualizar URL sem recarregar — útil se o projeto usar roteamento externo
          try {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          } catch (e) {
            // Ignorar se pushState falhar
          }
        } catch (e) {
          // ignore
        }
      }
    });

    return () => unsubscribe();
  }, [onSubscriptionSuccess]);

  const handlePay = async () => {
    setProcessing(true);

    const user = getCurrentUser();
    if (!user) {
      alert("Erro: Usuário não autenticado. Faça login novamente.");
      setProcessing(false);
      return;
    }

    const dadosDoPlano = {
      userId: user.uid,
      userEmail: user.email || "",
      planType: "MENSAL",
    };

    try {
      const resposta = await fetch("/api/createSubscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosDoPlano),
      });

      if (!resposta.ok) {
        const errorData = await resposta.json();
        throw new Error(
          errorData.error || "Falha ao comunicar com o servidor."
        );
      }

      const resultado = await resposta.json();

      if (resultado.checkoutUrl) {
        // Redirecionar para o checkout do Mercado Pago
        window.location.href = resultado.checkoutUrl;
      } else {
        alert("Falha ao gerar o link de pagamento.");
        setProcessing(false);
      }
    } catch (erro) {
      console.error("Erro ao conectar com o Back-End:", erro);
      alert(`Erro ao iniciar assinatura: ${(erro as Error).message}`);
      setProcessing(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="text-center space-y-4">
        <span className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider animate-pulse">
          Renove Sua Assinatura
        </span>
        <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">
          Continue Usando o 4us!
        </h2>
        <p className="text-xl text-gray-400">
          Seu período de acesso expirou. Renove agora para continuar aproveitando todas as ferramentas AI.
        </p>
      </div>

      <div className="mt-12 flex justify-center">
        {/* Monthly Plan Only */}
        <div className="w-full max-w-md bg-studio-card border-2 border-neon-purple rounded-3xl p-8 shadow-[0_0_30px_rgba(189,0,255,0.15)] flex flex-col h-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-neon-purple text-white px-4 py-2 rounded-bl-xl rounded-tr-2xl text-sm font-bold shadow-lg">
            PLANO PRO
          </div>
          <div className="mb-4 flex justify-between items-start">
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-green-500/50">
              Assinatura Mensal
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Mensal</h3>
          <div className="my-6">
            <span className="text-gray-500 line-through text-lg">
              R$ 798,00
            </span>
            <div className="flex items-end gap-1">
              <span className="text-gray-400 text-2xl font-bold">R$</span>
              <span className="text-white text-5xl font-bold">279</span>
              <span className="text-gray-400 mb-1">/mês</span>
            </div>
            <p className="text-neon-cyan text-sm mt-2 font-medium">
              Acesso completo por 30 dias
            </p>
          </div>
          <ul className="space-y-4 mb-8 text-white flex-1 font-medium">
            <li className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-neon-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>{" "}
              Acesso a todas as ferramentas AI
            </li>
            <li className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-neon-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>{" "}
              Consultorias ilimitadas
            </li>
            <li className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-neon-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>{" "}
              Geração de PDF e Imagens
            </li>
            <li className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-neon-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>{" "}
              Suporte prioritário
            </li>
          </ul>
          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-neon-purple to-neon-violet text-white shadow-lg hover:shadow-neon-purple/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Redirecionando para pagamento...
              </>
            ) : (
              "ASSINAR AGORA"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Visagismo } from "./components/Visagismo";
import { Colorista } from "./components/Colorista";
import { Hairstylist } from "./components/Hairstylist";
import { LookCreator } from "./components/LiveAssistant";
import { HairTherapist } from "./components/HairTherapist";
import { Chatbot } from "./components/Chatbot";
import { Dashboard } from "./components/Dashboard";
import { Subscription } from "./components/Subscription";
import { Library } from "./components/Library";
import { Login } from "./components/Login";
import { AppView } from "./types";
import {
  onAuthStateChange,
  getCurrentUser,
  getUserData,
} from "./services/authService";
import { validateAccess } from "./services/subscriptionService";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Observar mudanças no estado de autenticação
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        // Verificar acesso do usuário
        await checkUserAccess(user.uid);
      } else {
        setIsAuthenticated(false);
        setHasAccess(false);
        setIsCheckingAccess(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Reagir a evento global quando a assinatura for confirmada (Subscription component ou webhook)
  useEffect(() => {
    const handler = async (ev: Event) => {
      const user = getCurrentUser();
      if (user) {
        await checkUserAccess(user.uid);
      }
    };

    window.addEventListener("subscription_success", handler as EventListener);
    return () =>
      window.removeEventListener(
        "subscription_success",
        handler as EventListener
      );
  }, []);

  const checkUserAccess = async (uid: string) => {
    setIsCheckingAccess(true);
    try {
      const accessStatus = await validateAccess(uid);

      if (accessStatus.hasAccess) {
        setHasAccess(true);
        // Se estava na tela de subscription, voltar para dashboard
        if (currentView === AppView.SUBSCRIPTION) {
          setCurrentView(AppView.DASHBOARD);
        }
      } else {
        setHasAccess(false);
        // Redirecionar para tela de pagamento
        setCurrentView(AppView.SUBSCRIPTION);
      }
    } catch (error) {
      console.error("Erro ao verificar acesso:", error);
      setHasAccess(false);
      setCurrentView(AppView.SUBSCRIPTION);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    const user = getCurrentUser();
    if (user) {
      await checkUserAccess(user.uid);
      // Garantir que `trial_start_date` exista localmente para a UI
      try {
        const existing = localStorage.getItem("trial_start_date");
        if (!existing) {
          const userData = await getUserData(user.uid);
          if (userData && userData.trialEndsAt) {
            // Assumir trial de 48 horas: calcular início a partir de trialEndsAt
            const trialStartMs = userData.trialEndsAt - 48 * 60 * 60 * 1000;
            localStorage.setItem(
              "trial_start_date",
              new Date(trialStartMs).toISOString()
            );
          } else {
            localStorage.setItem("trial_start_date", new Date().toISOString());
          }
        }
      } catch (e) {
        console.warn("Erro ao garantir trial_start_date local:", e);
      }
    }
  };

  // Verificar acesso sempre que mudar de view (exceto subscription)
  // NOTE: removido verificação contínua ao mudar de view para evitar loops.

  // NOTE: removida verificação periódica para evitar loops e reloads.

  // Verificar acesso quando a página ganha foco (usuário volta do pagamento)
  useEffect(() => {
    const handleFocus = async () => {
      const user = getCurrentUser();
      if (user && isAuthenticated) {
        await checkUserAccess(user.uid);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isAuthenticated]);

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} />;
      case AppView.VISAGISMO:
        return <Visagismo />;
      case AppView.COLORISTA:
        return <Colorista />;
      case AppView.HAIRSTYLIST:
        return <Hairstylist />;
      case AppView.LOOK_CREATOR:
        return <LookCreator />;
      case AppView.HAIR_THERAPIST:
        return <HairTherapist />;
      case AppView.CHATBOT:
        return <Chatbot />;
      case AppView.SUBSCRIPTION:
        return <Subscription />;
      case AppView.LIBRARY:
        return <Library />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-studio-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-purple mx-auto mb-4"></div>
          <p className="text-gray-400">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Se não tem acesso, mostrar apenas a tela de subscription
  if (!hasAccess) {
    return (
      <Subscription
        onSubscriptionSuccess={async () => {
          const user = getCurrentUser();
          if (user) {
            await checkUserAccess(user.uid);
          }
        }}
      />
    );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;

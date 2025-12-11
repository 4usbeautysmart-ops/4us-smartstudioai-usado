import React, { useState, useEffect, useRef } from "react";
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
import { onAuthStateChange, getCurrentUser } from "./services/authService";
import { validateAccess } from "./services/subscriptionService";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./services/firebaseConfig";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Observar mudanças no estado de autenticação
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        // Verificar acesso do usuário
        await checkUserAccess(user.uid);

        // Monitorar mudanças no documento do usuário no Firebase
        // Isso detecta quando a data expira ou quando o pagamento é confirmado
        const userDocRef = doc(db, "users", user.uid);

        // Limpar listener anterior se existir
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        unsubscribeRef.current = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const userData = snapshot.data();
              const now = Date.now();

              // Determinar qual campo verificar baseado no status
              let expiresAt = 0;
              if (userData.subscriptionStatus === "trial") {
                expiresAt = userData.trialEndsAt || 0;
              } else if (userData.subscriptionStatus === "active") {
                expiresAt = userData.accessUntil || 0;
              }

              console.log("📊 Firebase atualizado:", {
                status: userData.subscriptionStatus,
                trialEndsAt: userData.trialEndsAt,
                accessUntil: userData.accessUntil,
                expiresAt,
                now,
                expired: expiresAt > 0 && now >= expiresAt,
                expiresAtDate:
                  expiresAt > 0
                    ? new Date(expiresAt).toLocaleString("pt-BR")
                    : "N/A",
                nowDate: new Date(now).toLocaleString("pt-BR"),
              });

              // Sempre verificar acesso quando o documento é atualizado
              await checkUserAccess(user.uid);
            } else {
              // Se o documento não existe, não tem acesso
              console.log("❌ Documento do usuário não existe no Firebase");
              setHasAccess(false);
              setCurrentView(AppView.SUBSCRIPTION);
            }
          },
          (error) => {
            console.error("🔥 Erro no listener do Firebase:", error);
          }
        );
      } else {
        setIsAuthenticated(false);
        setHasAccess(false);
        setIsCheckingAccess(false);
        // Limpar listener quando usuário faz logout
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const checkUserAccess = async (uid: string) => {
    setIsCheckingAccess(true);
    try {
      console.log("🔍 Verificando acesso do usuário:", uid);
      const accessStatus = await validateAccess(uid);
      console.log("📊 Resultado da validação:", accessStatus);

      if (accessStatus.hasAccess) {
        console.log("✅ Usuário tem acesso válido");
        setHasAccess(true);
        // Se estava na tela de subscription, voltar para dashboard
        if (currentView === AppView.SUBSCRIPTION) {
          setCurrentView(AppView.DASHBOARD);
        }
      } else {
        console.log(
          "❌ Usuário NÃO tem acesso. Redirecionando para pagamento..."
        );
        setHasAccess(false);
        // Redirecionar para tela de pagamento
        setCurrentView(AppView.SUBSCRIPTION);
      }
    } catch (error) {
      console.error("🔥 Erro ao verificar acesso:", error);
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
    }
  };

  // Verificar acesso sempre que mudar de view (exceto subscription)
  useEffect(() => {
    if (
      isAuthenticated &&
      currentView !== AppView.SUBSCRIPTION &&
      currentView !== AppView.LOGIN
    ) {
      const user = getCurrentUser();
      if (user) {
        console.log("🔄 Verificando acesso ao mudar de view...");
        validateAccess(user.uid).then((accessStatus) => {
          console.log("📊 Status ao mudar view:", accessStatus);
          if (!accessStatus.hasAccess) {
            console.log("❌ Sem acesso! Redirecionando...");
            setHasAccess(false);
            setCurrentView(AppView.SUBSCRIPTION);
          }
        });
      }
    }
  }, [currentView, isAuthenticated]);

  // Verificação imediata ao montar o componente (se já estiver autenticado)
  useEffect(() => {
    const user = getCurrentUser();
    if (user && isAuthenticated) {
      console.log("🚀 Verificação inicial de acesso...");
      checkUserAccess(user.uid);
    }
  }, []);

  // Verificar acesso periodicamente (a cada 10 segundos quando tem acesso)
  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return;

    const interval = setInterval(async () => {
      const user = getCurrentUser();
      if (user) {
        console.log("🔄 Verificando acesso periodicamente...");
        const accessStatus = await validateAccess(user.uid);
        console.log("📊 Status de acesso:", accessStatus);
        if (!accessStatus.hasAccess) {
          console.log("❌ Acesso expirado! Redirecionando para pagamento...");
          setHasAccess(false);
          setCurrentView(AppView.SUBSCRIPTION);
        }
      }
    }, 10000); // 10 segundos (mais frequente para detectar expiração rapidamente)

    return () => clearInterval(interval);
  }, [isAuthenticated, hasAccess]);

  // Verificar acesso mais frequentemente quando não tem acesso (na tela de pagamento)
  useEffect(() => {
    if (!isAuthenticated || hasAccess) return;

    const interval = setInterval(async () => {
      const user = getCurrentUser();
      if (user) {
        const accessStatus = await validateAccess(user.uid);
        if (accessStatus.hasAccess) {
          setHasAccess(true);
          setCurrentView(AppView.DASHBOARD);
        }
      }
    }, 5000); // 5 segundos quando está na tela de pagamento

    return () => clearInterval(interval);
  }, [isAuthenticated, hasAccess]);

  // Verificar acesso quando a página ganha foco (usuário volta do pagamento)
  // useEffect(() => {
  //   const handleFocus = async () => {
  //     const user = getCurrentUser();
  //     if (user && isAuthenticated) {
  //       await checkUserAccess(user.uid);
  //     }
  //   };

  //   window.addEventListener('focus', handleFocus);
  //   return () => window.removeEventListener('focus', handleFocus);
  // }, [isAuthenticated]);

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

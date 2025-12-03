import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Visagismo } from './components/Visagismo';
import { Colorista } from './components/Colorista';
import { Hairstylist } from './components/Hairstylist';
import { LookCreator } from './components/LiveAssistant';
import { HairTherapist } from './components/HairTherapist';
import { Chatbot } from './components/Chatbot';
import { Dashboard } from './components/Dashboard';
import { Subscription } from './components/Subscription';
import { Library } from './components/Library';
import { Login } from './components/Login';
import { AppView } from './types';
import { onAuthStateChange, getCurrentUser } from './services/authService';
import { validateAccess } from './services/subscriptionService';

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
      console.error('Erro ao verificar acesso:', error);
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
    if (isAuthenticated && currentView !== AppView.SUBSCRIPTION && currentView !== AppView.LOGIN) {
      const user = getCurrentUser();
      if (user) {
        validateAccess(user.uid).then(accessStatus => {
          if (!accessStatus.hasAccess) {
            setHasAccess(false);
            setCurrentView(AppView.SUBSCRIPTION);
          }
        });
      }
    }
  }, [currentView, isAuthenticated]);

  // Verificar acesso periodicamente (a cada 30 segundos)
  useEffect(() => {
    if (!isAuthenticated || !hasAccess) return;

    const interval = setInterval(async () => {
      const user = getCurrentUser();
      if (user) {
        const accessStatus = await validateAccess(user.uid);
        if (!accessStatus.hasAccess) {
          setHasAccess(false);
          setCurrentView(AppView.SUBSCRIPTION);
        }
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [isAuthenticated, hasAccess]);

  // Verificar acesso quando a página ganha foco (usuário volta do pagamento)
  useEffect(() => {
    const handleFocus = async () => {
      const user = getCurrentUser();
      if (user && isAuthenticated) {
        await checkUserAccess(user.uid);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
      return <Subscription onSubscriptionSuccess={async () => {
          const user = getCurrentUser();
          if (user) {
              await checkUserAccess(user.uid);
          }
      }} />;
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;
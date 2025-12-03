import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';
import { validateAccess, AccessStatus } from '../services/subscriptionService';

export const useAccessControl = () => {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAccess();
    
    // Verificar acesso a cada minuto
    const interval = setInterval(() => {
      checkAccess();
    }, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, []);

  const checkAccess = async () => {
    setIsChecking(true);
    try {
      const user = getCurrentUser();
      if (user) {
        const status = await validateAccess(user.uid);
        setAccessStatus(status);
      } else {
        setAccessStatus({
          hasAccess: false,
          subscriptionStatus: 'expired',
          expiresAt: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar acesso:', error);
      setAccessStatus({
        hasAccess: false,
        subscriptionStatus: 'expired',
        expiresAt: 0,
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Função para verificar acesso antes de executar uma ação
  const requireAccess = (callback: () => void | Promise<void>) => {
    return async () => {
      await checkAccess();
      
      if (accessStatus?.hasAccess) {
        await callback();
      } else {
        // Redirecionar para tela de pagamento será feito pelo App.tsx
        alert('Seu acesso expirou. Por favor, renove sua assinatura para continuar usando o app.');
      }
    };
  };

  return {
    accessStatus,
    isChecking,
    hasAccess: accessStatus?.hasAccess ?? false,
    checkAccess,
    requireAccess,
  };
};


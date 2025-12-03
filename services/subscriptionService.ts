import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserData } from './authService';

export interface AccessStatus {
  hasAccess: boolean;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  expiresAt: number;
  daysRemaining?: number;
  hoursRemaining?: number;
}

// Validar se o usuário tem acesso válido
export const validateAccess = async (uid: string): Promise<AccessStatus> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (!userDoc.exists()) {
      return {
        hasAccess: false,
        subscriptionStatus: 'expired',
        expiresAt: 0,
      };
    }

    const userData = userDoc.data() as UserData;
    const now = Date.now();
    const accessUntil = userData.accessUntil || 0;

    // Verificar se o acesso expirou
    if (now >= accessUntil) {
      // Atualizar status para expired se ainda não estiver
      if (userData.subscriptionStatus !== 'expired') {
        await updateDoc(doc(db, 'users', uid), {
          subscriptionStatus: 'expired',
          updatedAt: serverTimestamp(),
        });
      }

      return {
        hasAccess: false,
        subscriptionStatus: 'expired',
        expiresAt: accessUntil,
      };
    }

    // Calcular tempo restante
    const timeRemaining = accessUntil - now;
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    return {
      hasAccess: true,
      subscriptionStatus: userData.subscriptionStatus,
      expiresAt: accessUntil,
      daysRemaining,
      hoursRemaining,
    };
  } catch (error: any) {
    console.error('Erro ao validar acesso:', error);
    return {
      hasAccess: false,
      subscriptionStatus: 'expired',
      expiresAt: 0,
    };
  }
};

// Verificar se precisa renovar (30 dias após pagamento)
export const shouldRenewSubscription = async (uid: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (!userDoc.exists()) {
      return true;
    }

    const userData = userDoc.data() as UserData;
    
    // Se está em trial, não precisa renovar ainda
    if (userData.subscriptionStatus === 'trial') {
      return false;
    }

    // Se está ativo, verificar se está próximo do vencimento (7 dias antes)
    if (userData.subscriptionStatus === 'active') {
      const now = Date.now();
      const accessUntil = userData.accessUntil || 0;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      return (accessUntil - now) < sevenDays;
    }

    return true;
  } catch (error: any) {
    console.error('Erro ao verificar renovação:', error);
    return true;
  }
};


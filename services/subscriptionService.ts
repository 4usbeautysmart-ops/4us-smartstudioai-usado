import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { UserData } from "./authService";

export interface AccessStatus {
  hasAccess: boolean;
  subscriptionStatus: "trial" | "active" | "expired";
  expiresAt: number;
  daysRemaining?: number;
  hoursRemaining?: number;
}

// Validar se o usuário tem acesso válido
export const validateAccess = async (uid: string): Promise<AccessStatus> => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (!userDoc.exists()) {
      console.log("❌ Documento do usuário não existe");
      return {
        hasAccess: false,
        subscriptionStatus: "expired",
        expiresAt: 0,
      };
    }

    const userData = userDoc.data() as UserData;

    // Admin: sempre tem acesso, sem verificar trial/assinatura
    const adminEmail = "admin@jailson.com";
    if (userData.email && userData.email.toLowerCase() === adminEmail.toLowerCase()) {
      return {
        hasAccess: true,
        subscriptionStatus: "active",
        expiresAt: Number.MAX_SAFE_INTEGER,
        daysRemaining: 999,
        hoursRemaining: 999,
      };
    }

    const now = Date.now();

    // Determinar qual campo verificar baseado no status
    let expiresAt = 0;

    if (userData.subscriptionStatus === "trial") {
      // Se está em trial, verificar trialEndsAt
      expiresAt = userData.trialEndsAt || 0;
      console.log("🔍 Verificando TRIAL:", {
        trialEndsAt: userData.trialEndsAt,
        now,
        expired: now >= expiresAt,
        trialEndsAtDate: new Date(expiresAt).toLocaleString("pt-BR"),
      });
    } else if (userData.subscriptionStatus === "active") {
      // Se está ativo, verificar accessUntil
      expiresAt = userData.accessUntil || 0;
      console.log("🔍 Verificando ACTIVE:", {
        accessUntil: expiresAt,
        now,
        expired: now >= expiresAt,
        accessUntilDate: new Date(expiresAt).toLocaleString("pt-BR"),
      });
    } else {
      // Se já está expired, não tem acesso
      console.log("❌ Status já está como expired");
      return {
        hasAccess: false,
        subscriptionStatus: "expired",
        expiresAt: userData.accessUntil || userData.trialEndsAt || 0,
      };
    }

    // Verificar se o acesso expirou
    if (expiresAt === 0 || now >= expiresAt) {
      console.log("⏰ Acesso EXPIRADO!", {
        expiresAt,
        now,
        diff: now - expiresAt,
        expiresAtDate: new Date(expiresAt).toLocaleString("pt-BR"),
        nowDate: new Date(now).toLocaleString("pt-BR"),
      });

      // Atualizar status para expired se ainda não estiver
      if (userData.subscriptionStatus !== "expired") {
        await updateDoc(doc(db, "users", uid), {
          subscriptionStatus: "expired",
          updatedAt: serverTimestamp(),
        });
        console.log("✅ Status atualizado para expired no Firebase");
      }

      return {
        hasAccess: false,
        subscriptionStatus: "expired",
        expiresAt: expiresAt,
      };
    }

    // Calcular tempo restante
    const timeRemaining = expiresAt - now;
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor(
      (timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
    );

    console.log("✅ Acesso VÁLIDO:", {
      status: userData.subscriptionStatus,
      expiresAt,
      daysRemaining,
      hoursRemaining,
      expiresAtDate: new Date(expiresAt).toLocaleString("pt-BR"),
    });

    return {
      hasAccess: true,
      subscriptionStatus: userData.subscriptionStatus,
      expiresAt: expiresAt,
      daysRemaining,
      hoursRemaining,
    };
  } catch (error: any) {
    console.error("🔥 Erro ao validar acesso:", error);
    return {
      hasAccess: false,
      subscriptionStatus: "expired",
      expiresAt: 0,
    };
  }
};

// Verificar se precisa renovar (30 dias após pagamento)
export const shouldRenewSubscription = async (
  uid: string
): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (!userDoc.exists()) {
      return true;
    }

    const userData = userDoc.data() as UserData;

    // Se está em trial, não precisa renovar ainda
    if (userData.subscriptionStatus === "trial") {
      return false;
    }

    // Se está ativo, verificar se está próximo do vencimento (7 dias antes)
    if (userData.subscriptionStatus === "active") {
      const now = Date.now();
      const accessUntil = userData.accessUntil || 0;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      return accessUntil - now < sevenDays;
    }

    return true;
  } catch (error: any) {
    console.error("Erro ao verificar renovação:", error);
    return true;
  }
};

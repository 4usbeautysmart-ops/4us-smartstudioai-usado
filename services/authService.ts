import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  User,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export interface UserData {
  email: string;
  fullName: string;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  trialEndsAt: number;
  accessUntil: number;
  createdAt: any;
  updatedAt: any;
  paymentId?: string;
}

// Criar conta com trial de 48 horas
export const createAccount = async (
  email: string, 
  password: string, 
  fullName: string
): Promise<UserCredential> => {
  try {
    // Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Calcular datas do trial (48 horas)
    const now = Date.now();
    const trialEndsAt = now + (48 * 60 * 60 * 1000); // 48 horas em milissegundos
    const accessUntil = trialEndsAt;

    // Criar documento do usuário no Firestore
    const userData: UserData = {
      email: user.email || email,
      fullName,
      subscriptionStatus: 'trial',
      trialEndsAt,
      accessUntil,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    return userCredential;
  } catch (error: any) {
    console.error('Erro ao criar conta:', error);
    throw error;
  }
};

// Fazer login
export const login = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.error('Erro ao fazer login:', error);
    throw error;
  }
};

// Fazer logout
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Erro ao fazer logout:', error);
    throw error;
  }
};

// Obter dados do usuário do Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error: any) {
    console.error('Erro ao obter dados do usuário:', error);
    return null;
  }
};

// Observar mudanças no estado de autenticação
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Obter usuário atual
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};


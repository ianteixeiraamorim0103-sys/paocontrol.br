// @ts-ignore
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
// @ts-ignore
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: "AIzaSyDezizLByX7O-h5_T5STFoi3l33iSB19zY",
  authDomain: "paocontrol-d28ec.firebaseapp.com",
  projectId: "paocontrol-d28ec",
  storageBucket: "paocontrol-d28ec.firebasestorage.app",
  messagingSenderId: "853547255999",
  appId: "1:853547255999:web:7d0cb920e94de810c55e0a"
};

// VAPID Key do Firebase
const VAPID_KEY = "BFcsHiztQblss6Zu17QwAjIkiCqOZA_2jXXoSEY51XLNNbcGS3K1f5jp42m4Pi4kCF9sE5AOFsMLHZDNygfCwaw";

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function solicitarPermissaoNotificacao(userId: string, supabase: any): Promise<boolean> {
  try {
    // Pede permissão ao usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permissão de notificação negada');
      return false;
    }

    // Gera o token do dispositivo
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return false;

    console.log('FCM Token gerado:', token);

    // Salva o token no Supabase vinculado ao usuário
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId, 
        fcm_token: token,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Erro ao salvar token:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao configurar notificações:', err);
    return false;
  }
}

export function ouvirNotificacoes(callback: (payload: any) => void) {
  onMessage(messaging, (payload) => {
    console.log('Notificação recebida em primeiro plano:', payload);
    callback(payload);
  });
}

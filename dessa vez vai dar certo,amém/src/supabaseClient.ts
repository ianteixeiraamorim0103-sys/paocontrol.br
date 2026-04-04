import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO: Variáveis de ambiente do Supabase não encontradas. Certifique-se de configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos segredos do AI Studio.');
}

// Inicializa o cliente apenas se as chaves forem válidas para evitar erro de inicialização
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Package, 
  Loader2, 
  AlertCircle, 
  ShoppingBasket, 
  LogIn, 
  LogOut, 
  User, 
  Lock,
  AlertTriangle,
  Pencil,
  Check,
  X,
  UserPlus,
  Eye,
  EyeOff,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabaseClient';
import { cn } from './lib/utils';
import { solicitarPermissaoNotificacao, ouvirNotificacoes } from './firebase';

// Types
interface Produto {
  id: string | number;
  nome_produto: string;
  quantidade: number;
  estoque_minimo: number;
}

export default function App() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [novoNome, setNovoNome] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novoMinimo, setNovoMinimo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [editMin, setEditMin] = useState<string>('');
  
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auth Listener
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Erro ao obter sessão:', error.message);
        // Se o token de refresh for inválido, limpamos a sessão local
        if (error.message.includes('Refresh Token Not Found')) {
          supabase.auth.signOut();
          setSession(null);
        }
      } else {
        setSession(session);
        if (session?.user?.id) {
          solicitarPermissaoNotificacao(session.user.id, supabase);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Evento de Auth:', event);
      setSession(session);
      
      if (event === 'SIGNED_IN' && session?.user?.id) {
        solicitarPermissaoNotificacao(session.user.id, supabase);
      }

      // Se a sessão for perdida por erro de refresh, garantimos que o estado seja limpo
      if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    // Configura o ouvinte de notificações em primeiro plano
    ouvirNotificacoes((payload) => {
      setNotification({ 
        message: `Notificação: ${payload.notification?.title || 'Nova mensagem'}`, 
        type: 'success' 
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data when session changes
  useEffect(() => {
    if (session) {
      buscarDados();
      solicitarPermissaoNotificacao(session.user.id, supabase);
    } else {
      setLoading(false);
    }
  }, [session]);

  async function buscarDados() {
    if (!supabase) return;
    try {
      setLoading(true);
      
      let query = supabase
        .from('estoque_geral')
        .select('*')
        .order('nome_produto', { ascending: true });

      // Filtra pelo user_id do Supabase se estiver logado
      if (session?.user?.id) {
        console.log('Filtrando estoque para User ID:', session.user.id);
        query = query.eq('user_id', session.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProdutos(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados:', err);
      setError(err.message || 'Erro ao carregar o estoque.');
    } finally {
      setLoading(false);
    }
  }

  async function adicionarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome || !novaQuantidade || !novoMinimo || !supabase) return;

    try {
      setIsSubmitting(true);
      const payload: any = { 
        nome_produto: novoNome, 
        quantidade: parseInt(novaQuantidade),
        estoque_minimo: parseInt(novoMinimo)
      };
      
      // Adiciona o user_id se estiver logado
      if (session?.user?.id) {
        payload.user_id = session.user.id;
      }

      const { error } = await supabase
        .from('estoque_geral')
        .insert([payload]);

      if (error) throw error;
      
      // Auto-refresh list
      await buscarDados();
      
      setNovoNome('');
      setNovaQuantidade('');
      setNovoMinimo('');
      setNotification({ message: 'Produto adicionado com sucesso!', type: 'success' });
    } catch (err: any) {
      setNotification({ message: 'Erro ao adicionar produto: ' + err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deletarProduto(id: string | number) {
    if (!supabase) return;
    
    console.log('Iniciando exclusão do produto:', id);
    const produtosAnteriores = [...produtos];
    
    try {
      setNotification({ message: 'Excluindo produto...', type: 'success' });
      setProdutos(prev => prev.filter(p => p.id !== id));
      
      let query = supabase
        .from('estoque_geral')
        .delete()
        .eq('id', id);

      if (session?.user?.id) {
        query = query.eq('user_id', session.user.id);
      }

      const { error } = await query;

      if (error) {
        console.error('Erro ao deletar no Supabase:', error);
        setProdutos(produtosAnteriores);
        setNotification({ message: 'Erro ao deletar: ' + error.message, type: 'error' });
      } else {
        setNotification({ message: 'Produto excluído com sucesso!', type: 'success' });
      }
    } catch (err: any) {
      console.error('Erro inesperado na exclusão:', err);
      setProdutos(produtosAnteriores);
      setNotification({ message: 'Erro inesperado: ' + err.message, type: 'error' });
    }
  }

  async function salvarEdicao(id: string | number) {
    if (!supabase || editQty === '' || editMin === '') return;
    
    const novaQuantidade = parseInt(editQty);
    const novoMinimo = parseInt(editMin);
    
    if (isNaN(novaQuantidade) || isNaN(novoMinimo)) return;

    try {
      let query = supabase
        .from('estoque_geral')
        .update({ 
          quantidade: novaQuantidade,
          estoque_minimo: novoMinimo
        })
        .eq('id', id);

      if (session?.user?.id) {
        query = query.eq('user_id', session.user.id);
      }

      const { error } = await query;

      if (error) throw error;
      
      setProdutos(produtos.map(p => p.id === id ? { 
        ...p, 
        quantidade: novaQuantidade,
        estoque_minimo: novoMinimo 
      } : p));
      setEditingId(null);
      setNotification({ message: 'Produto atualizado com sucesso!', type: 'success' });
    } catch (err: any) {
      setNotification({ message: 'Erro ao atualizar: ' + err.message, type: 'error' });
    }
  }

  const testSupabaseConnection = async () => {
    if (!supabase) {
      setNotification({ 
        message: 'ERRO: Supabase não inicializado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.', 
        type: 'error' 
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.from('produtos').select('count', { count: 'exact', head: true });
      if (error) throw error;
      setNotification({ message: 'Conexão com Supabase estabelecida com sucesso!', type: 'success' });
    } catch (err: any) {
      console.error('Erro ao testar conexão:', err);
      setNotification({ 
        message: 'Erro de conexão: ' + (err.message || 'Verifique se as tabelas existem e se as chaves estão corretas.'), 
        type: 'error' 
      });
    }
  };

  const handleResendConfirmation = async () => {
    if (!supabase) return;
    const email = loginEmail.trim();
    if (!email) {
      setNotification({ message: 'Por favor, insira seu e-mail para reenviar a confirmação.', type: 'error' });
      return;
    }
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      setNotification({ message: 'E-mail de confirmação reenviado! Verifique sua caixa de entrada.', type: 'success' });
    } catch (err: any) {
      console.error('Erro ao reenviar confirmação:', err);
      setNotification({ message: 'Erro ao reenviar: ' + err.message, type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!supabase) return;
    const email = loginEmail.trim();
    if (!email) {
      setNotification({ message: 'Por favor, insira seu e-mail para recuperar a senha.', type: 'error' });
      return;
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setNotification({ message: 'Link de recuperação enviado para o seu e-mail!', type: 'success' });
    } catch (err: any) {
      console.error('Erro ao recuperar senha:', err);
      setNotification({ message: 'Erro ao recuperar senha: ' + err.message, type: 'error' });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setNotification({ 
        message: 'Erro: Configuração do Supabase ausente. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.', 
        type: 'error' 
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginError(false);
    
    try {
      const email = loginEmail.trim();
      const password = loginPassword;

      if (!email || !password) {
        throw new Error('E-mail e senha são obrigatórios.');
      }

      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        throw new Error('Por favor, insira um e-mail válido.');
      }

      console.log('Tentando login para:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      setNotification({ message: 'Bem-vindo ao PãoControl!', type: 'success' });
    } catch (err: any) {
      console.error('Erro no login (detalhes):', JSON.stringify(err, null, 2));
      setLoginError(true);
      let msg = err.message;
      
      // Supabase specific error handling
      const lowerMsg = msg.toLowerCase();
      const errCode = err.code || '';
      
      if (lowerMsg.includes('invalid login credentials') || errCode === 'invalid_credentials') {
        msg = 'E-mail ou senha incorretos. Verifique se digitou corretamente ou se confirmou seu e-mail (cheque o SPAM).';
      } else if (lowerMsg.includes('email not confirmed')) {
        msg = 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou spam.';
      } else if (lowerMsg.includes('rate limit')) {
        msg = 'Muitas tentativas de login. Por favor, aguarde um momento.';
      } else if (lowerMsg.includes('refresh token not found')) {
        msg = 'Sessão expirada. Por favor, tente entrar novamente.';
        // Limpa qualquer estado de sessão residual
        if (supabase) supabase.auth.signOut();
        setSession(null);
      }
      
      setNotification({ message: 'Erro ao entrar: ' + msg, type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setNotification({ 
        message: 'Erro: Configuração do Supabase ausente.', 
        type: 'error' 
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginError(false);
    
    try {
      const email = loginEmail.trim();
      const password = loginPassword;

      if (!email || !password) {
        throw new Error('E-mail e senha são obrigatórios.');
      }

      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        throw new Error('Por favor, insira um e-mail válido.');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      setNotification({ 
        message: 'Conta criada! IMPORTANTE: Verifique seu e-mail (e a pasta SPAM) para confirmar o cadastro antes de tentar entrar.', 
        type: 'success' 
      });
      setIsSignUp(false);
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setLoginError(true);
      let msg = err.message;

      if (msg.toLowerCase().includes('user already registered') || msg.toLowerCase().includes('already registered')) {
        msg = 'Este e-mail já está cadastrado. Você já pode fazer login com ele!';
        // Auto-switch to login mode after a short delay if they are already registered
        setTimeout(() => {
          setIsSignUp(false);
          setLoginError(false);
        }, 3000);
      } else if (msg.toLowerCase().includes('rate limit')) {
        msg = 'Muitas tentativas de cadastro. Por favor, aguarde um momento.';
      } else if (msg.toLowerCase().includes('refresh token not found')) {
        msg = 'Sessão expirada. Por favor, tente entrar novamente.';
        // Limpa qualquer estado de sessão residual
        if (supabase) supabase.auth.signOut();
        setSession(null);
      }

      setNotification({ message: 'Erro ao criar conta: ' + msg, type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setNotification({ message: 'Sessão encerrada.', type: 'success' });
  };

  // View: Login Page
  if (!session) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center p-4 font-sans selection:bg-[#e6d5c3]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-[3rem] p-10 sm:p-12 shadow-2xl shadow-[#4a3728]/10 border border-[#e6d5c3] relative overflow-hidden">
            {/* Decorative element */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#fdfaf6] rounded-full border border-[#e6d5c3]/30" />
            
            <div className="relative z-10 space-y-10">
              <div className="text-center space-y-4">
                <div className="bg-[#5a5a40] w-16 h-16 rounded-2xl shadow-lg shadow-[#5a5a40]/20 flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                  <ShoppingBasket className="text-white w-8 h-8" />
                </div>
                <h1 className="text-4xl font-serif font-bold text-[#2d1f15] tracking-tight">PãoControl</h1>
                <p className="text-[#8c7a6b] text-sm font-medium uppercase tracking-[0.2em]">
                  {isSignUp ? 'Criar Nova Conta' : 'Acesso ao Sistema'}
                </p>
              </div>

              <motion.form 
                onSubmit={isSignUp ? handleSignUp : handleLogin} 
                className="space-y-6"
                animate={loginError ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#b5a69a] ml-1">E-mail</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b5a69a] group-focus-within:text-[#5a5a40] transition-colors" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setLoginError(false);
                      }}
                      placeholder="seu@email.com"
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border ${loginError ? 'border-red-500 bg-red-50' : 'border-[#e6d5c3]'} focus:ring-2 focus:ring-[#5a5a40] focus:border-transparent outline-none transition-all placeholder:text-[#d1c4b8] text-[#2d1f15]`}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#b5a69a] ml-1">Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b5a69a] group-focus-within:text-[#5a5a40] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError(false);
                      }}
                      placeholder="••••••••"
                      className={`w-full pl-12 pr-12 py-4 rounded-2xl border ${loginError ? 'border-red-500 bg-red-50' : 'border-[#e6d5c3]'} focus:ring-2 focus:ring-[#5a5a40] focus:border-transparent outline-none transition-all placeholder:text-[#d1c4b8] text-[#2d1f15]`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b5a69a] hover:text-[#5a5a40] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <div className="flex flex-col items-end gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleResetPassword();
                          setLoginError(false);
                        }}
                        className="text-[10px] font-bold text-[#5a5a40] hover:underline uppercase tracking-widest"
                      >
                        Esqueci minha senha
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleResendConfirmation();
                          setLoginError(false);
                        }}
                        className="text-[10px] font-bold text-[#8c7a6b] hover:underline uppercase tracking-widest"
                      >
                        Reenviar e-mail de confirmação
                      </button>
                    </div>
                  )}
                </div>

                {loginError && !isSignUp && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#fdfaf6] border border-[#e6d5c3] rounded-xl p-4 space-y-2"
                  >
                    <p className="text-[11px] text-[#8c7a6b] font-medium leading-relaxed">
                      <span className="text-[#5a5a40] font-bold uppercase tracking-wider block mb-1">Dica:</span>
                      Se você tem certeza que o e-mail e senha estão corretos, verifique se confirmou seu cadastro no link enviado para o seu e-mail (olhe também na pasta de SPAM).
                    </p>
                  </motion.div>
                )}

                {loginError && isSignUp && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#fdfaf6] border border-[#e6d5c3] rounded-xl p-4 space-y-2"
                  >
                    <p className="text-[11px] text-[#8c7a6b] font-medium leading-relaxed">
                      <span className="text-[#5a5a40] font-bold uppercase tracking-wider block mb-1">Aviso:</span>
                      Este e-mail já possui uma conta. Vamos te redirecionar para a tela de login em instantes para que você possa entrar.
                    </p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-[#5a5a40] hover:bg-[#4a4a34] text-white font-bold py-4 rounded-2xl shadow-xl shadow-[#5a5a40]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isSignUp ? (
                    <UserPlus className="w-6 h-6" />
                  ) : (
                    <LogIn className="w-6 h-6" />
                  )}
                  {isSignUp ? 'Cadastrar' : 'Entrar no Painel'}
                </button>
              </motion.form>

              <div className="text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setLoginError(false);
                  }}
                  className="text-sm font-bold text-[#5a5a40] hover:underline"
                >
                  {isSignUp ? 'Já tenho uma conta. Entrar' : 'Não tem conta? Criar agora'}
                </button>
              </div>

              <div className="pt-6 text-center space-y-4">
                <button
                  onClick={testSupabaseConnection}
                  className="text-[10px] font-bold text-[#b5a69a] hover:text-[#5a5a40] uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <AlertCircle className="w-3 h-3" />
                  Testar Conexão com Supabase
                </button>
                <p className="text-[10px] uppercase tracking-widest text-[#b5a69a] font-bold">PãoControl Systems © 2026</p>
              </div>
            </div>
          </div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8 text-[#8c7a6b] text-sm italic font-serif"
          >
            "Onde o pão é sagrado e o estoque é organizado."
          </motion.p>
        </motion.div>

        {/* Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className={cn(
                "fixed bottom-8 left-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border",
                notification.type === 'success' 
                  ? "bg-white border-green-100 text-green-800" 
                  : "bg-white border-red-100 text-red-800"
              )}
            >
              {notification.type === 'success' ? (
                <div className="bg-green-500 p-1 rounded-full text-white">
                  <Plus className="w-4 h-4 rotate-45" />
                </div>
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <p className="text-sm font-bold">{notification.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // View: Dashboard
  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#4a3728] font-sans selection:bg-[#e6d5c3]">
      {/* Header */}
      <header className="bg-white border-b border-[#e6d5c3] sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#5a5a40] p-2 rounded-xl shadow-lg">
              <ShoppingBasket className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-[#2d1f15]">PãoControl</h1>
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#8c7a6b] font-semibold">Estoque de Padaria</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => {
                if (session?.user?.id) {
                  solicitarPermissaoNotificacao(session.user.id, supabase).then(success => {
                    if (success) {
                      setNotification({ message: 'Notificações ativadas com sucesso!', type: 'success' });
                    } else {
                      setNotification({ message: 'Erro ao ativar notificações ou permissão negada.', type: 'error' });
                    }
                  });
                }
              }}
              className="flex items-center gap-2 bg-white border border-[#e6d5c3] text-[#8c7a6b] hover:text-[#5a5a40] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[10px] sm:text-xs font-bold transition-all active:scale-95"
              title="Ativar Notificações"
            >
              <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Notificações</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white border border-[#e6d5c3] text-[#8c7a6b] hover:text-red-500 hover:border-red-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[10px] sm:text-xs font-bold transition-all active:scale-95"
              title="Sair"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
          
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Form Section */}
        <section className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-[#4a3728]/5 border border-[#e6d5c3]">
          <h2 className="text-lg font-serif font-bold mb-6 flex items-center gap-2 text-[#2d1f15]">
            <Plus className="w-5 h-5 text-[#5a5a40]" />
            Novo Produto
          </h2>
          <form onSubmit={adicionarProduto} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c7a6b] ml-1">Nome do Produto</label>
              <input
                type="text"
                placeholder="Ex: Pão Francês"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-[#e6d5c3] focus:ring-2 focus:ring-[#5a5a40] focus:border-transparent outline-none transition-all placeholder:text-[#b5a69a]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c7a6b] ml-1">Quantidade Atual</label>
              <input
                type="number"
                placeholder="0"
                value={novaQuantidade}
                onChange={(e) => setNovaQuantidade(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-[#e6d5c3] focus:ring-2 focus:ring-[#5a5a40] focus:border-transparent outline-none transition-all placeholder:text-[#b5a69a]"
                required
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8c7a6b] ml-1">Estoque Mínimo</label>
              <input
                type="number"
                placeholder="Ex: 10"
                value={novoMinimo}
                onChange={(e) => setNovoMinimo(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-[#e6d5c3] focus:ring-2 focus:ring-[#5a5a40] focus:border-transparent outline-none transition-all placeholder:text-[#b5a69a]"
                required
                min="0"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#5a5a40] hover:bg-[#4a4a34] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-[#5a5a40]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Cadastrar
              </button>
            </div>
          </form>
        </section>

        {/* List Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-serif font-bold flex items-center gap-2 text-[#2d1f15]">
              <Package className="w-5 h-5 text-[#5a5a40]" />
              Gestão de Estoque
            </h2>
            <div className="flex gap-2">
              <span className="text-[10px] font-bold bg-[#e6d5c3] text-[#4a3728] px-4 py-1.5 rounded-full uppercase tracking-wider">
                {produtos.length} {produtos.length === 1 ? 'Produto' : 'Produtos'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-[#5a5a40]" />
              <p className="text-[#8c7a6b] font-medium animate-pulse tracking-wide">Sincronizando estoque...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-100 rounded-[2rem] p-10 text-center space-y-4">
              <AlertCircle className="w-14 h-14 text-red-300 mx-auto" />
              <div className="space-y-2">
                <h3 className="font-bold text-red-800 text-lg">Erro de Conexão</h3>
                <p className="text-red-600/80 text-sm max-w-md mx-auto">{error}</p>
              </div>
              <button 
                onClick={buscarDados}
                className="bg-white text-red-600 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm hover:shadow-md transition-all"
              >
                Tentar novamente
              </button>
            </div>
          ) : produtos.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-16 text-center border border-dashed border-[#e6d5c3] space-y-6">
              <div className="bg-[#fdfaf6] w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <ShoppingBasket className="w-10 h-10 text-[#b5a69a]" />
              </div>
              <div className="space-y-2">
                <p className="text-[#2d1f15] text-lg font-bold">Nenhum produto cadastrado</p>
                <p className="text-[#8c7a6b] text-sm max-w-xs mx-auto">Seu inventário está vazio. Adicione itens acima para começar o controle.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {produtos.map((produto) => {
                  const isLowStock = produto.quantidade < produto.estoque_minimo;
                  const isOutStock = produto.quantidade === 0;

                  return (
                    <motion.div
                      key={produto.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={cn(
                        "relative bg-white rounded-[2rem] p-6 shadow-lg transition-all border group overflow-hidden",
                        isOutStock ? "border-red-200 bg-red-50/30" : 
                        isLowStock ? "border-orange-200 bg-orange-50/30" : 
                        "border-[#e6d5c3] hover:shadow-2xl hover:shadow-[#4a3728]/5"
                      )}
                    >
                      {/* Alert Badge */}
                      {(isLowStock || isOutStock) && (
                        <div className={cn(
                          "absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter",
                          isOutStock ? "bg-red-500 text-white" : "bg-orange-400 text-white"
                        )}>
                          <AlertTriangle className="w-3 h-3" />
                          {isOutStock ? 'Esgotado' : 'Abaixo do Mínimo'}
                        </div>
                      )}

                      <div className="flex flex-col h-full justify-between gap-6">
                        <div className="space-y-1">
                          <h3 className="font-bold text-xl text-[#2d1f15] group-hover:text-[#5a5a40] transition-colors line-clamp-1">
                            {produto.nome_produto}
                          </h3>
                          {editingId === produto.id ? (
                            <div className="space-y-2 mt-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold uppercase text-[#8c7a6b]">Mínimo</label>
                                <input
                                  type="number"
                                  value={editMin}
                                  onChange={(e) => setEditMin(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-[#e6d5c3] text-sm font-bold outline-none focus:ring-2 focus:ring-[#5a5a40]"
                                  placeholder="Mínimo"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold uppercase text-[#8c7a6b]">Quantidade Atual</label>
                                <input
                                  type="number"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-[#e6d5c3] text-sm font-bold outline-none focus:ring-2 focus:ring-[#5a5a40]"
                                  placeholder="Quantidade"
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => salvarEdicao(produto.id)}
                                  className="flex-1 bg-[#5a5a40] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Salvar
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] font-bold text-[#b5a69a] uppercase tracking-widest">
                              Mínimo: {produto.estoque_minimo} unidades
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {editingId !== produto.id && (
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[#8c7a6b] uppercase tracking-tighter">Estoque Atual</span>
                                <span className={cn(
                                  "font-mono font-black text-3xl",
                                  isOutStock ? "text-red-600" : isLowStock ? "text-orange-600" : "text-[#2d1f15]"
                                )}>
                                  {produto.quantidade}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {editingId !== produto.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingId(produto.id);
                                    setEditQty(produto.quantidade.toString());
                                    setEditMin(produto.estoque_minimo.toString());
                                  }}
                                  className="p-3 text-[#b5a69a] hover:text-[#5a5a40] hover:bg-[#fdfaf6] rounded-2xl transition-all active:scale-90"
                                  title="Editar produto"
                                >
                                  <Pencil className="w-5 h-5" />
                                </button>

                                <button
                                  onClick={() => deletarProduto(produto.id)}
                                  className="p-3 text-[#b5a69a] hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                  title="Excluir produto"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-12 h-0.5 bg-[#e6d5c3] mx-auto mb-6"></div>
        <p className="text-sm font-serif italic text-[#8c7a6b]">"Onde o pão é sagrado e o estoque é organizado."</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#b5a69a] font-bold">© 2026 PãoControl Systems</p>
      </footer>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border",
              notification.type === 'success' 
                ? "bg-white border-green-100 text-green-800" 
                : "bg-white border-red-100 text-red-800"
            )}
          >
            {notification.type === 'success' ? (
              <div className="bg-green-500 p-1 rounded-full text-white">
                <Plus className="w-4 h-4 rotate-45" />
              </div>
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <p className="text-sm font-bold">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

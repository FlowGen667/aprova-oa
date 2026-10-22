// Worker da landing de Yamileth Gill - versão mínima
// - /api/*        → rotas básicas (sem banco D1)
// - /dashboard/*  → painel acessível (dados fictícios no HTML)
// - resto         → arquivos estáticos de ./public

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Assets - servir arquivos estáticos
    if (path.startsWith('/dashboard/assets/') || 
        path.startsWith('/assets/') ||
        path === '/apple-touch-icon.png' ||
        path === '/favicon.png' ||
        path === '/hero_mobile_solta.png' ||
        path === '/logo.png' ||
        path === '/flowgen.png' ||
        path === '/index.html' ||
        path === '/' ||
        path.startsWith('/hero') ||
        path.startsWith('/flowgen')) {
      return env.ASSETS.fetch(request);
    }
    
    // API pública - login fake
    if (path === '/api/login' && request.method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'yg_session=teste; Path=/; HttpOnly' }
      });
    }
    
    // Painel - acessível para testes (dados fictícios incorporados no HTML)
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      if (path === '/dashboard/login' || path === '/dashboard/login.html') {
        return env.ASSETS.fetch(new Request(new URL('/dashboard/login', url), request));
      }
      // Dashboard principal - HTML com dados fictícios já embutidos
      return env.ASSETS.fetch(new Request(new URL('/dashboard/', url), request));
    }
    
    return env.ASSETS.fetch(request);
  }
};
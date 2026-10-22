// Worker da landing de Yamileth Gill - versão simplificada
// - /api/*        → rastreamento público e API (sem banco D1)
// - /dashboard/*  → painel acessível para testes (sem senha)
// - resto         → arquivos estáticos de ./public

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Rotas públicas do site
    if (path === '/' || path === '/index.html') {
      return env.ASSETS.fetch(request);
    }
    
    // Rotas da landing page
    if (path.startsWith('/hero') || path.startsWith('/flowgen') || path.startsWith('/apple-touch') || path.startsWith('/favicon') || path.startsWith('/logo')) {
      return env.ASSETS.fetch(request);
    }
    
    // Rotas da API públicas
    if (path.startsWith('/api/')) {
      return await handleApi(request, url);
    }
    
    // Painel - ACESSÍVEL PARA TESTES (sem senha)
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      // Se for login.html, mostrar página de login
      if (path === '/dashboard/login' || path === '/dashboard/login.html') {
        return env.ASSETS.fetch(new Request(new URL('/dashboard/login', url), request));
      }
      // Dashboard principal - liberado para testes
      return env.ASSETS.fetch(new Request(new URL('/dashboard/', url), request));
    }
    
    // Assets
    return env.ASSETS.fetch(request);
  },
};

/* ---------- API pública ---------- */

async function handleApi(request, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;
  
  // Rastreamento simples (sem banco)
  if (path === '/track' && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Configuração pública
  if (path === '/config' && method === 'GET') {
    return new Response(JSON.stringify({ 
      metaPixelId: '', 
      ga4Id: '' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Login fake - aceita qualquer coisa, só retorna ok
  if (path === '/login' && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'yg_session=teste; Path=/; HttpOnly'
      }
    });
  }
  
  // Logout (falso)
  if (path === '/logout' && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'yg_session=; Path=/; HttpOnly; Max-Age=0'
      }
    });
  }
  
  return new Response(JSON.stringify({ error: 'Rota não encontrada' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
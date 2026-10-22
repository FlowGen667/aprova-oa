// Worker da landing de Yamileth Gill - versão simplificada com dados fictícios
// - /dashboard/assets/* → CSS/JS do painel (primeira prioridade)
// - /dashboard/*        → painel HTML (segunda prioridade)
// - /api/*              → rotas com dados fictícios (sem banco D1)
// - resto                → arquivos estáticos de ./public

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // PRIMEIRO: Assets do dashboard - CSS, JS, imagens do painel
    if (path.startsWith('/dashboard/assets/')) {
      return env.ASSETS.fetch(request);
    }
    
    // SEGUNDO: Painel - ACESSÍVEL PARA TESTES (sem senha)
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      if (path === '/dashboard/login' || path === '/dashboard/login.html') {
        return env.ASSETS.fetch(new Request(new URL('/dashboard/login', url), request));
      }
      return env.ASSETS.fetch(new Request(new URL('/dashboard/', url), request));
    }
    
    // TERCEIRO: API - Dados fictícios (sem banco de dados - evita erro JSON)
    if (path === '/api/stats' && request.method === 'GET') {
      return new Response(JSON.stringify({
        range: { days: 30 },
        kpis: {
          visitors: 1247,
          pageviews: 3892,
          sessions: 842,
          clicks: 234,
          clickers: 156,
          leads: 47,
          customers: 12,
          revenue: 8950
        },
        stages: {
          nuevo: 15,
          contactado: 23,
          negociando: 12,
          cliente: 8,
          perdido: 5
        },
        hasData: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/leads' && request.method === 'GET') {
      const fakeLeads = [
        { id: 1, name: 'João Silva', email: 'joao@email.com', stage: 'cliente', value: 2450, source: 'Instagram', created_at: '2026-09-15' },
        { id: 2, name: 'Maria Oliveira', email: 'maria@email.com', stage: 'negociando', value: 1800, source: 'Facebook', created_at: '2026-09-14' },
        { id: 3, name: 'Pedro Santos', email: 'pedro@email.com', stage: 'contactado', value: 950, source: 'Google', created_at: '2026-09-13' },
        { id: 4, name: 'Ana Costa', email: 'ana@email.com', stage: 'nuevo', value: 500, source: 'LinkedIn', created_at: '2026-09-12' },
        { id: 5, name: 'Carlos Lima', email: 'carlos@email.com', stage: 'cliente', value: 3200, source: 'Indicacao', created_at: '2026-09-11' }
      ];
      return new Response(JSON.stringify({ leads: fakeLeads }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/dashboard' && request.method === 'GET') {
      return new Response(JSON.stringify({
        resumo: {
          totalLeads: 47,
          novos: 15,
          emAndamento: 35,
          clientes: 12,
          receita: 8950
        },
        graficos: {
          porEtapa: { labels: ['Novo', 'Contato', 'Negociando', 'Cliente', 'Perdido'], data: [15, 23, 12, 8, 5] },
          porFonte: { labels: ['Instagram', 'Facebook', 'Google', 'LinkedIn', 'Indicacao'], data: [25, 20, 22, 15, 15] }
        },
        ultimasAtividades: [
          { id: 1, lead: 'João Silva', acao: 'Comprou curso', data: '2026-09-15' },
          { id: 2, lead: 'Maria Oliveira', acao: 'Entrou em contato', data: '2026-09-14' },
          { id: 3, lead: 'Pedro Santos', acao: 'Visualizou curso', data: '2026-09-13' }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Login fake - aceita qualquer senha
    if (path === '/api/login' && request.method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'yg_session=teste; Path=/; HttpOnly' }
      });
    }
    
    // API catch-all - retorna JSON válido
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: true, data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // QUARTO: Assets gerais do site
    if (path.startsWith('/assets/') ||
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
    
    // Landing page routes
    if (path === '/' || path === '/index.html') {
      return env.ASSETS.fetch(request);
    }
    
    // Fallback para assets
    return env.ASSETS.fetch(request);
  }
};
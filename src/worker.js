// Worker da landing de Yamileth Gill - versão simplificada com dados fictícios
// - /dashboard/assets/* → CSS/JS do painel (primeira prioridade)
// - /dashboard/*        → painel HTML (segunda prioridade)
// - /api/*              → rotas com dados fictícios (sem banco D1)
// - resto                → arquivos estáticos de ./public

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const search = url.search;
    
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
    
    // API - Dados fictícios (sem banco de dados - evita erro JSON)
    // Formato compatível com o app.js do dashboard
    
    // /api/stats?days=30&tz=...
    if (path === '/api/stats' && request.method === 'GET') {
      const days = search.includes('days=') ? search.split('days=')[1].split('&')[0] : '30';
      const tz = search.includes('tz=') ? search.split('tz=')[1] : '';
      
      const now = Date.now();
      const baseDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      
      // Gerar series diárias para os últimos 30 dias
      const series = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i);
        const dayStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const visitors = Math.floor(Math.random() * 50) + 20; // 20-70 por dia
        const leads = Math.floor(Math.random() * 5);
        series.push({ day: dayStr, visitors, leads });
      }
      
      return new Response(JSON.stringify({
        range: { days: parseInt(days) || 30 },
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
        hasData: true,
        series: series,
        prev: {
          visitors: 1100,
          pageviews: 3500,
          sessions: 700,
          clicks: 200,
          clickers: 130,
          leads: 40,
          customers: 10,
          revenue: 8000
        },
        sources: [
          { name: 'Instagram', visitors: 850, leads: 20 },
          { name: 'Facebook', visitors: 600, leads: 15 },
          { name: 'Google', visitors: 550, leads: 12 },
          { name: 'LinkedIn', visitors: 300, leads: 8 },
          { name: 'Indicacao', visitors: 200, leads: 5 }
        ],
        heatmap: [
          { dow: 0, hour: 10, n: 15 }, { dow: 0, hour: 14, n: 12 }, { dow: 0, hour: 20, n: 8 },
          { dow: 1, hour: 11, n: 18 }, { dow: 1, hour: 16, n: 14 },
          { dow: 2, hour: 12, n: 16 }, { dow: 2, hour: 18, n: 10 },
          { dow: 3, hour: 11, n: 20 }, { dow: 3, hour: 17, n: 15 },
          { dow: 4, hour: 13, n: 22 }, { dow: 4, hour: 19, n: 18 },
          { dow: 5, hour: 12, n: 25 }, { dow: 5, hour: 18, n: 20 },
          { dow: 6, hour: 11, n: 30 }, { dow: 6, hour: 16, n: 28 }
        ],
        scroll: [
          { name: '25%', visitors: 310 },
          { name: '50%', visitors: 420 },
          { name: '75%', visitors: 510 }
        ],
        sections: [
          { name: 'sobre', visitors: 950 },
          { name: 'por-que', visitors: 800 },
          { name: 'cursos', visitors: 750 },
          { name: 'empezar', visitors: 600 }
        ],
        devices: [
          { name: 'Desktop', visitors: 650 },
          { name: 'Mobile', visitors: 550 },
          { name: 'Tablet', visitors: 80 }
        ],
        countries: [
          { name: 'BR', visitors: 450 },
          { name: 'US', visitors: 300 },
          { name: 'ES', visitors: 200 },
          { name: 'PT', visitors: 150 }
        ],
        browsers: [
          { name: 'Chrome', visitors: 700 },
          { name: 'Safari', visitors: 400 },
          { name: 'Firefox', visitors: 150 },
          { name: 'Edge', visitors: 80 }
        ],
        campaigns: [
          { name: 'reel-codigo-500', source: 'Instagram', medium: 'social', visitors: 350, leads: 12 },
          { name: 'video-01', source: 'Facebook', medium: 'paid', visitors: 280, leads: 8 },
          { name: 'post-1', source: 'LinkedIn', medium: 'social', visitors: 150, leads: 5 }
        ],
        clicks: [
          { name: 'hero:conocer_cursos', clicks: 45, unique_clicks: 38 },
          { name: 'cierre:elegir_entrenamiento', clicks: 32, unique_clicks: 28 },
          { name: 'hero:inscripcion', clicks: 28, unique_clicks: 25 }
        ],
        leads: [
          { id: 1, name: 'João Silva', email: 'joao@email.com', stage: 'cliente', value: 2450, source: 'Instagram', created_at: now - 5 * 24 * 60 * 60 * 1000 },
          { id: 2, name: 'Maria Oliveira', email: 'maria@email.com', stage: 'negociando', value: 1800, source: 'Facebook', created_at: now - 4 * 24 * 60 * 60 * 1000 },
          { id: 3, name: 'Pedro Santos', email: 'pedro@email.com', stage: 'contactado', value: 950, source: 'Google', created_at: now - 3 * 24 * 60 * 60 * 1000 },
          { id: 4, name: 'Ana Costa', email: 'ana@email.com', stage: 'nuevo', value: 500, source: 'LinkedIn', created_at: now - 2 * 24 * 60 * 60 * 1000 },
          { id: 5, name: 'Carlos Lima', email: 'carlos@email.com', stage: 'cliente', value: 3200, source: 'Indicacao', created_at: now - 1 * 24 * 60 * 60 * 1000 }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // /api/leads
    if (path === '/api/leads' && request.method === 'GET') {
      const fakeLeads = [
        { id: 1, name: 'João Silva', email: 'joao@email.com', stage: 'cliente', value: 2450, source: 'Instagram', medium: 'social', campaign: 'reel-codigo-500', interest: 'Curso Express', device: 'Desktop', country: 'BR', created_at: Date.now() - 5 * 24 * 60 * 60 * 1000 },
        { id: 2, name: 'Maria Oliveira', email: 'maria@email.com', stage: 'negociando', value: 1800, source: 'Facebook', medium: 'social', campaign: 'video-01', interest: 'Inmersión', device: 'Mobile', country: 'BR', created_at: Date.now() - 4 * 24 * 60 * 60 * 1000 },
        { id: 3, name: 'Pedro Santos', email: 'pedro@email.com', stage: 'contactado', value: 950, source: 'Google', medium: 'organic', campaign: null, interest: null, device: 'Desktop', country: 'BR', created_at: Date.now() - 3 * 24 * 60 * 60 * 1000 },
        { id: 4, name: 'Ana Costa', email: 'ana@email.com', stage: 'nuevo', value: 500, source: 'LinkedIn', medium: 'social', campaign: 'post-1', interest: 'Curso Orgânico', device: 'Mobile', country: 'BR', created_at: Date.now() - 2 * 24 * 60 * 60 * 1000 },
        { id: 5, name: 'Carlos Lima', email: 'carlos@email.com', stage: 'cliente', value: 3200, source: 'Indicacao', medium: 'referral', campaign: null, interest: null, device: 'Desktop', country: 'BR', created_at: Date.now() - 1 * 24 * 60 * 60 * 1000 }
      ];
      return new Response(JSON.stringify({ leads: fakeLeads }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // /api/leads/:id (PATCH para atualizar etapa)
    if (path.startsWith('/api/leads/') && request.method === 'PATCH') {
      const leadId = path.split('/')[3];
      return new Response(JSON.stringify({ 
        id: parseInt(leadId), 
        stage: 'cliente', 
        updated_at: Date.now() 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // /api/dashboard
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
    
    // Assets gerais do site
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
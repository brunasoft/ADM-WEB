// api/atendimentos.js - VERSÃO CORRIGIDA
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Configurar CORS para compatibilidade com frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'POST') {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const {
    id, cliente_id, titulo, modulo = null, motivo = null,
    data = null, solicitante = null, col = 'aberto',
    problem = null, solution = null
  } = body || {};

  await sql`
    INSERT INTO atendimentos (id, cliente_id, titulo, modulo, motivo, data, solicitante, status, problem, solution)
    VALUES (${id}, ${cliente_id}, ${titulo}, ${modulo}, ${motivo}, ${data}, ${solicitante}, ${col}, ${problem}, ${solution})
    ON CONFLICT (id) DO UPDATE SET
      cliente_id=${cliente_id}, titulo=${titulo}, modulo=${modulo},
      motivo=${motivo}, data=${data}, solicitante=${solicitante},
      status=${col}, problem=${problem}, solution=${solution}
  `;

  return res.status(201).json({ ok:true });
}

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, col, problem, solution, solicitante } = body || {};
      
      if (!id) {
        return res.status(400).json({ ok: false, error: 'id é obrigatório' });
      }

      // Atualização dinâmica baseada nos campos fornecidos
      if (col) {
        await sql`UPDATE atendimentos SET status = ${col} WHERE id = ${id}`;
      }
      
      if (problem !== undefined) {
        await sql`UPDATE atendimentos SET problem = ${problem} WHERE id = ${id}`;
      }
      
      if (solution !== undefined) {
        await sql`UPDATE atendimentos SET solution = ${solution} WHERE id = ${id}`;
      }
      
      if (solicitante !== undefined) {
        await sql`UPDATE atendimentos SET solicitante = ${solicitante} WHERE id = ${id}`;
      }

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ ok: false, error: 'id é obrigatório' });
      }

      await sql`DELETE FROM atendimentos WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    // GET: lista todos os atendimentos com JOIN para dados do cliente
    const rows = await sql`
      SELECT a.*, c.codigo, c.nome 
      FROM atendimentos a 
      LEFT JOIN clientes c ON a.cliente_id = c.id 
      ORDER BY a.created_at DESC
    `;
    
    const out = rows.map(r => ({
      id: r.id,
      titulo: r.titulo,
      modulo: r.modulo,
      motivo: r.motivo,
      data: r.data ? new Date(r.data).toISOString().split('T')[0] : '',
      solicitante: r.solicitante,
      col: r.status,
      clienteId: r.cliente_id,
      codigo: r.codigo,
      nome: r.nome,
      problem: r.problem,
      solution: r.solution,
      created_at: r.created_at
    }));

    return res.status(200).json(out);

  } catch (e) {
    console.error('Erro na API de atendimentos:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// /api/atendimentos.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS simples (permite chamadas do seu site)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // CREATE/UPSERT
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        id, cliente_id, titulo, modulo = null, motivo = null,
        data = null, solicitante = null, col = 'aberto',
        problem = null, solution = null
      } = body || {};

      await sql`
        INSERT INTO atendimentos (id, cliente_id, titulo, modulo, motivo, data, solicitante, status, problem, solution)
        VALUES (${id}, ${cliente_id}, ${titulo}, ${modulo}, ${motivo}, ${data}, ${solicitante}, ${col}, ${problem}, ${solution})
        ON CONFLICT (id) DO UPDATE SET
          cliente_id=${cliente_id}, titulo=${titulo}, modulo=${modulo},
          motivo=${motivo}, data=${data}, solicitante=${solicitante},
          status=${col}, problem=${problem}, solution=${solution}
      `;
      return res.status(201).json({ ok: true });
    }

    // UPDATE parcial (mudar coluna/status, problema, solução, solicitante…)
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, col, problem, solution, solicitante } = body || {};
      if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });

      if (col        !== undefined) await sql`UPDATE atendimentos SET status      = ${col}        WHERE id = ${id}`;
      if (problem    !== undefined) await sql`UPDATE atendimentos SET problem     = ${problem}    WHERE id = ${id}`;
      if (solution   !== undefined) await sql`UPDATE atendimentos SET solution    = ${solution}   WHERE id = ${id}`;
      if (solicitante!== undefined) await sql`UPDATE atendimentos SET solicitante = ${solicitante}WHERE id = ${id}`;

      return res.status(200).json({ ok: true });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
      await sql`DELETE FROM atendimentos WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    // GET (lista todos + dados do cliente)
    const rows = await sql`
      SELECT a.*, c.codigo, c.nome
      FROM atendimentos a
      LEFT JOIN clientes c ON a.cliente_id = c.id
      ORDER BY a.created_at DESC
    `;

    const out = rows.map(r => ({
      id: r.id,
      titulo: r.titulo,
      modulo: r.modulo,
      motivo: r.motivo,
      data: r.data ? new Date(r.data).toISOString().split('T')[0] : '',
      solicitante: r.solicitante,
      col: r.status,
      clienteId: r.cliente_id,
      codigo: r.codigo,
      nome: r.nome,
      problem: r.problem,
      solution: r.solution,
      created_at: r.created_at
    }));

    return res.status(200).json(out);
  } catch (e) {
    console.error('Erro na API de atendimentos:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

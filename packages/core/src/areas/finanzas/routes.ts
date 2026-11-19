import type {
  CategoriasResponse,
  FiltrosMovimientos,
  MovimientoInput,
  MovimientoResponse,
  MovimientosResponse,
  ResumenFinanzas,
  TipoMovimiento,
} from '@ger/shared/areas/finanzas/movimientos.ts';
import { defineAreaRoutes } from '../../api/areaRoutes.ts';
import { removeWithAttachments } from '../../records/service.ts';
import {
  createMovimiento,
  deleteMovimiento,
  getMovimiento,
  getResumen,
  listCategorias,
  listMovimientos,
  updateMovimiento,
} from './service.ts';

/**
 * API de Finanzas, montada en `/areas/finanzas/`. Capa fina: cada ruta llama
 * a una función del servicio, que es la que valida. Los errores
 * (ValidationError → 400, NotFoundError → 404) los traduce el servidor.
 */

type CodeParams = { Params: { code: string } };

export default defineAreaRoutes(async (app, { db, media }) => {
  app.get<{ Querystring: FiltrosMovimientos }>(
    '/movimientos',
    async (request): Promise<MovimientosResponse> => ({ movimientos: listMovimientos(db, request.query) }),
  );

  app.post<{ Body: MovimientoInput }>('/movimientos', async (request, reply) => {
    const movimiento = createMovimiento(db, request.body);
    return reply.code(201).send({ movimiento } satisfies MovimientoResponse);
  });

  app.get<CodeParams>(
    '/movimientos/:code',
    async (request): Promise<MovimientoResponse> => ({ movimiento: getMovimiento(db, request.params.code) }),
  );

  app.patch<CodeParams & { Body: Partial<MovimientoInput> }>(
    '/movimientos/:code',
    async (request): Promise<MovimientoResponse> => ({ movimiento: updateMovimiento(db, request.params.code, request.body) }),
  );

  // Borra también sus fotos, igual que `borrar` en el bot.
  app.delete<CodeParams>('/movimientos/:code', async (request, reply) => {
    removeWithAttachments(db, media, () => deleteMovimiento(db, request.params.code));
    return reply.code(204).send();
  });

  app.get<{ Querystring: { tipo?: TipoMovimiento } }>(
    '/categorias',
    async (request): Promise<CategoriasResponse> => ({ categorias: listCategorias(db, request.query.tipo) }),
  );

  app.get<{ Querystring: { mes?: string; meses?: string } }>('/resumen', async (request): Promise<ResumenFinanzas> => {
    const { mes, meses } = request.query;
    return getResumen(db, { mes, meses: meses === undefined ? undefined : Number(meses) });
  });
});

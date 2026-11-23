// server/io/curio.ts
import { identifyCurios, getCuriosByOwner, getAllCurioTags, getCuriosByTag, getMuseumCurios } from '~/server/utils/game/curio';
import { CurioIdentifyRequest, CurioIdentifyResponse, CurioQueryRequest, CurioQueryResponse, CurioTagsResponse, CurioByTagRequest, CurioByTagResponse, CurioMuseumRequest, CurioMuseumResponse } from '~/shared/types/curio';
import { emitEventToUser } from '~/server/io';
import { DefaultEventsMap, Socket } from 'socket.io';
import { GameSocketData } from '~/shared/types/socket';

export async function curioIdentify(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CurioIdentifyRequest>
): Promise<void> {
  const userUuid = data.user.uuid;

  try {
    const results = await identifyCurios(userUuid, data.data.count);
    emitEventToUser(userUuid, 'curio:identify:success', { results });
  } catch (error: any) {
    console.error('Curio identify error:', error);
    emitEventToUser(userUuid, 'curio:identify:error', { message: error.message || '内部服务器错误' });
  }
}

export async function curioQuery(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CurioQueryRequest>
): Promise<void> {
  const userUuid = data.user.uuid;

  try {
    const { curios, total } = await getCuriosByOwner(userUuid, data.data.page, data.data.limit);
    emitEventToUser(userUuid, 'curio:query:success', { curios, total });
  } catch (error) {
    console.error('Curio query error:', error);
    emitEventToUser(userUuid, 'curio:query:error', { message: '内部服务器错误' });
  }
}

export async function curioGetTags(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<{}>
): Promise<void> {
  const userUuid = data.user;

  try {
    const tags = await getAllCurioTags();
    emitEventToUser(userUuid, 'curio:getTags:success', { tags });
  } catch (error) {
    console.error('Curio get tags error:', error);
    emitEventToUser(userUuid, 'curio:getTags:error', { message: '内部服务器错误' });
  }
}

export async function curioQueryByTag(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CurioByTagRequest>
): Promise<void> {
  const userUuid = data.user.uuid;

  try {
    const { curios, total } = await getCuriosByTag(userUuid, data.data.tag, data.data.page, data.data.limit);
    emitEventToUser(userUuid, 'curio:queryByTag:success', { curios, total });
  } catch (error) {
    console.error('Curio query by tag error:', error);
    emitEventToUser(userUuid, 'curio:queryByTag:error', { message: '内部服务器错误' });
  }
}

export async function curioMuseum(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  data: GameSocketData<CurioMuseumRequest>
): Promise<void> {
  const userUuid = data.user.uuid;

  try {
    const { curios, total } = await getMuseumCurios(data.data.page, data.data.limit);
    emitEventToUser(userUuid, 'curio:museum:success', { curios, total });
  } catch (error) {
    console.error('Curio museum error:', error);
    emitEventToUser(userUuid, 'curio:museum:error', { message: '内部服务器错误' });
  }
}
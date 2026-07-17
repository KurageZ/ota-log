import type { ChekiRepository } from '../repositories/ChekiRepository';

type ChekiReader = Pick<ChekiRepository, 'findAll'>;

export async function initializeChekiPhotoWidget(_chekiRepository: ChekiReader): Promise<void> {}

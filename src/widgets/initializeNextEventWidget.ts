import type { EventRepository } from '../repositories/EventRepository';
import type { PhotoRepository } from '../repositories/PhotoRepository';

export async function initializeNextEventWidget(_repository: EventRepository, _photos?: Pick<PhotoRepository, 'findByEventId'>): Promise<void> {}

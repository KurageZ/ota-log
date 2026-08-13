export interface ChekiViewerItem {
  id: string;
  itemId?: string;
  photoUri: string;
  frontPhotoUri?: string | null;
  backPhotoUri?: string | null;
  side?: 'front' | 'back';
  isFavorite?: boolean;
  spec?: import('../domain/chekiSpec').ChekiSpec;
  date: string | null;
  price: number | null;
  notes: string | null;
  artistId: string | null;
  artistName: string | null;
  eventId: string | null;
  eventTitle: string | null;
}

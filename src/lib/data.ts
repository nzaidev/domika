import type { Lead, Property } from "./types";

export const PROPERTY_PHOTOS = [
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80',
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=900&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
  'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80',
];

export const AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&q=80',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80',
];

export const LEADS: Record<string, Lead[]> = {
  nuevo: [
    { id: 1, name: 'Sofía Ramírez', zone: 'Zona Norte', budget: '$320K', type: 'Apartamento', avatar: AVATARS[0] },
    { id: 2, name: 'Juan Carlos Vega', zone: 'Centro', budget: '$180K', type: 'Casa', avatar: AVATARS[5] },
    { id: 3, name: 'Lucía Mendoza', zone: 'Costa Este', budget: '$540K', type: 'Penthouse', avatar: AVATARS[1] },
  ],
  contactado: [
    { id: 4, name: 'Diego Fernández', zone: 'Bella Vista', budget: '$240K', type: 'Apartamento', avatar: AVATARS[2] },
    { id: 5, name: 'Ana Patricia Cruz', zone: 'Zona Norte', budget: '$410K', type: 'Casa', avatar: AVATARS[6] },
  ],
  visita: [
    { id: 6, name: 'Roberto Silva', zone: 'Punta Cana', budget: '$680K', type: 'Villa', avatar: AVATARS[3] },
    { id: 7, name: 'María Elena Ortiz', zone: 'Naco', budget: '$295K', type: 'Apartamento', avatar: AVATARS[7] },
    { id: 8, name: 'Felipe Castro', zone: 'Piantini', budget: '$520K', type: 'Penthouse', avatar: AVATARS[4] },
  ],
  negociacion: [
    { id: 9, name: 'Carla Jiménez', zone: 'Mirador Sur', budget: '$390K', type: 'Casa', avatar: AVATARS[1] },
    { id: 10, name: 'Andrés Peña', zone: 'Bávaro', budget: '$450K', type: 'Apartamento', avatar: AVATARS[5] },
  ],
  cierre: [
    { id: 11, name: 'Valentina Soto', zone: 'Anacaona', budget: '$720K', type: 'Penthouse', avatar: AVATARS[0] },
  ],
};

export const PROPERTIES: Property[] = [
  { id: 1, photo: PROPERTY_PHOTOS[0], price: '$485,000', type: 'Penthouse', title: 'Penthouse con vista al mar', loc: 'Cap Cana, Punta Cana', beds: 3, baths: 3.5, sqm: 280, status: 'active', shared: true, photos: 24 },
  { id: 2, photo: PROPERTY_PHOTOS[1], price: '$320,000', type: 'Apartamento', title: 'Torre Vista Real · Piso 18', loc: 'Piantini, Santo Domingo', beds: 3, baths: 2, sqm: 180, status: 'active', photos: 18 },
  { id: 3, photo: PROPERTY_PHOTOS[2], price: '$610,000', type: 'Villa', title: 'Villa con piscina infinita', loc: 'Casa de Campo, La Romana', beds: 5, baths: 5, sqm: 520, status: 'active', shared: true, photos: 32 },
  { id: 4, photo: PROPERTY_PHOTOS[3], price: '$245,000', type: 'Apartamento', title: 'Loft moderno en Naco', loc: 'Naco, Santo Domingo', beds: 2, baths: 2, sqm: 120, status: 'draft', photos: 12 },
  { id: 5, photo: PROPERTY_PHOTOS[4], price: '$890,000', type: 'Penthouse', title: 'Penthouse Anacaona doble altura', loc: 'Anacaona, Santo Domingo', beds: 4, baths: 4.5, sqm: 380, status: 'active', shared: true, photos: 28 },
  { id: 6, photo: PROPERTY_PHOTOS[5], price: '$195,000', type: 'Casa', title: 'Casa familiar en Bella Vista', loc: 'Bella Vista, Santo Domingo', beds: 4, baths: 3, sqm: 220, status: 'active', photos: 16 },
  { id: 7, photo: PROPERTY_PHOTOS[6], price: '$420,000', type: 'Apartamento', title: 'Apto. moderno en Mirador', loc: 'Mirador Sur, Santo Domingo', beds: 3, baths: 2.5, sqm: 195, status: 'draft', photos: 14 },
  { id: 8, photo: PROPERTY_PHOTOS[7], price: '$560,000', type: 'Villa', title: 'Villa en primera línea de playa', loc: 'Bávaro, Punta Cana', beds: 4, baths: 4, sqm: 340, status: 'active', shared: true, photos: 22 },
];

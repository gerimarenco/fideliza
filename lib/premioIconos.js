'use client';

// Set fijo de íconos SVG (Lucide) para elegir el ícono de un premio, en vez
// de un input de texto libre para tipear cualquier emoji -- un emoji se ve
// distinto en cada dispositivo/sistema operativo y rompe la coherencia
// visual del panel. `Premio.emoji` (nombre de columna sin cambiar, para no
// tocar el schema) ahora guarda una de estas claves en vez de un emoji.
import { Gift, Package, ShoppingBag, Shirt, SprayCan, Percent, Tag, Star, Heart, Coffee, Watch, Gem, Flower2, Cake, Ticket, Sparkles } from 'lucide-react';

export const ICONOS_PREMIO = [
  { clave: 'gift', Icono: Gift },
  { clave: 'package', Icono: Package },
  { clave: 'shopping-bag', Icono: ShoppingBag },
  { clave: 'shirt', Icono: Shirt },
  { clave: 'spray-can', Icono: SprayCan },
  { clave: 'percent', Icono: Percent },
  { clave: 'tag', Icono: Tag },
  { clave: 'star', Icono: Star },
  { clave: 'heart', Icono: Heart },
  { clave: 'coffee', Icono: Coffee },
  { clave: 'watch', Icono: Watch },
  { clave: 'gem', Icono: Gem },
  { clave: 'flower', Icono: Flower2 },
  { clave: 'cake', Icono: Cake },
  { clave: 'ticket', Icono: Ticket },
  { clave: 'sparkles', Icono: Sparkles },
];

const MAPA_ICONOS = Object.fromEntries(ICONOS_PREMIO.map(({ clave, Icono }) => [clave, Icono]));

// Premios cargados antes de este cambio tienen un emoji literal guardado en
// vez de una de las claves de arriba (ej. "🎀", "📦", "👜") -- se traducen a
// su ícono más parecido para que sigan viéndose bien sin que nadie tenga que
// volver a editarlos.
const EMOJI_LEGACY_A_ICONO = {
  '🎀': 'gift', '📦': 'package', '👜': 'shopping-bag', '☕': 'coffee',
  '👕': 'shirt', '👗': 'shirt', '🧣': 'shirt', '🧴': 'spray-can',
  '🌸': 'flower', '💐': 'flower', '⭐': 'star', '❤️': 'heart',
  '⌚': 'watch', '💍': 'gem', '💎': 'gem', '🎂': 'cake', '🎟️': 'ticket',
  '✨': 'sparkles', '🏷️': 'tag', '💰': 'percent', '🎁': 'gift',
};

export function IconoPremio({ nombre, size = 16 }) {
  const clave = MAPA_ICONOS[nombre] ? nombre : EMOJI_LEGACY_A_ICONO[nombre];
  const Icono = MAPA_ICONOS[clave] || Gift;
  return <Icono size={size} strokeWidth={2} />;
}

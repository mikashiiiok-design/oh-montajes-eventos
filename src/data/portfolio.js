import confiarImage from '../assets/confiar.webp'
import f2rImage from '../assets/f2r.webp'
import plantasImage from '../assets/plantas.webp'
import shieldImage from '../assets/shield.webp'

const festivalImageUrl = (width) => `https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=${width}&q=80`

export const projects = [
  {
    number: '01',
    title: 'FESTIVAL DE MÚSICA',
    category: 'MONTAJE · FESTIVAL',
    location: 'Medellín, Colombia',
    image: festivalImageUrl(1600),
    srcSet: [480, 800, 1200, 1600].map((width) => `${festivalImageUrl(width)} ${width}w`).join(', '),
    alt: 'Festival al aire libre con luces encendidas y público frente al escenario',
  },
  {
    number: '02',
    title: 'F2R - FERIA DE 2 RUEDAS',
    category: 'MONTAJE · FERIA',
    location: 'Medellín, Colombia',
    image: f2rImage,
    alt: 'Stand de F2R en la Feria de las 2 Ruedas de Medellín',
  },
  {
    number: '03',
    title: 'SHIELD COSMETICS',
    category: 'MONTAJE · FERIA',
    location: 'Medellín, Colombia',
    image: shieldImage,
    alt: 'Montaje de SHIELD Cosmetics para una feria en Medellín',
  },
  {
    number: '04',
    title: 'MOBILIARIO',
    category: 'MOBILIARIO · MUESTRA',
    location: 'Medellín, Colombia',
    image: plantasImage,
    alt: 'Composición vegetal y mobiliario para un espacio de evento',
  },
  {
    number: '05',
    title: 'CONFIAR',
    category: 'MONTAJE · FERIA',
    location: 'Medellín, Colombia',
    image: confiarImage,
    alt: 'Espacio de Confiar preparado para una feria en Medellín',
  },
]

export const services = [
  {
    number: '01',
    title: 'Producción integral',
    description: 'Del primer plano a la última carga. Coordinamos cada equipo, proveedor y detalle para que todo suceda a tiempo.',
    tags: ['Planificación', 'Presupuesto', 'Coordinación'],
  },
  {
    number: '02',
    title: 'Diseño y montaje',
    description: 'Espacios con intención y estructuras impecables, diseñadas para funcionar tan bien como se ven.',
    tags: ['Escenografía', 'Estructuras', 'Ambientación'],
  },
  {
    number: '03',
    title: 'Producción técnica',
    description: 'Sonido, iluminación, vídeo y energía. Tecnología al servicio de una experiencia que se recuerda.',
    tags: ['Sonido', 'Iluminación', 'Audiovisual'],
  },
]
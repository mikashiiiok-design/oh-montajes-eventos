const imageUrl = (photoId) => `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1100&q=78`

export const galleryCategories = [
  {
    id: 'paneleria',
    name: 'Panelería',
    description: 'Fondos y divisiones modulares para espacios de marca.',
    image: imageUrl('photo-1497366811353-6870744d04b2'),
    imageAlt: 'Espacio de trabajo modular con paneles y estaciones',
    products: [
      { id: 'panel-blanco', name: 'Panel blanco modular', detail: '1 × 2,4 m · acabado mate', price: 96000 },
      { id: 'panel-madera', name: 'Panel acabado madera', detail: '1 × 2,4 m · tono natural', price: 118000 },
      { id: 'panel-kit', name: 'Kit de tres paneles', detail: '3 módulos · incluye bases', price: 255000 },
    ],
  },
  {
    id: 'butacos',
    name: 'Butacos',
    description: 'Asientos altos para barras, mesas y zonas de encuentro.',
    image: imageUrl('photo-1503602642458-232111445657'),
    imageAlt: 'Asiento de diseño para espacios de evento',
    products: [
      { id: 'butaco-madera', name: 'Butaco de madera', detail: 'Altura de asiento 65 cm', price: 35000 },
      { id: 'butaco-metal', name: 'Butaco metal negro', detail: 'Altura de asiento 75 cm', price: 48000 },
      { id: 'butaco-respaldo', name: 'Butaco con respaldo', detail: 'Estructura metálica', price: 58000 },
    ],
  },
  {
    id: 'sillas',
    name: 'Sillas',
    description: 'Opciones para ceremonias, auditorios y mesas de invitados.',
    image: imageUrl('photo-1505693416388-ac5ce068fe85'),
    imageAlt: 'Sillas dispuestas en un ambiente preparado para reunión',
    products: [
      { id: 'silla-evento', name: 'Silla de evento', detail: 'Polipropileno · apilable', price: 22000 },
      { id: 'silla-crossback', name: 'Silla crossback', detail: 'Madera natural', price: 42000 },
      { id: 'silla-poltrona', name: 'Poltrona lounge', detail: 'Tapizado neutro', price: 98000 },
    ],
  },
  {
    id: 'decoracion',
    name: 'Decoración',
    description: 'Piezas de apoyo para ambientar mesas y rincones.',
    image: imageUrl('photo-1494438639946-1ebd1d20bf85'),
    imageAlt: 'Objetos decorativos y elementos de ambientación',
    products: [
      { id: 'florero-ceramica', name: 'Florero de cerámica', detail: 'Pieza de mesa · color neutro', price: 28000 },
      { id: 'centro-mesa', name: 'Centro de mesa', detail: 'Base decorativa · altura 35 cm', price: 65000 },
      { id: 'arreglo-verde', name: 'Arreglo verde', detail: 'Composición de follaje', price: 135000 },
    ],
  },
  {
    id: 'pantallas',
    name: 'Pantallas',
    description: 'Pantallas para presentaciones, contenido y señalización.',
    image: imageUrl('photo-1593359677879-a4bb92f829d1'),
    imageAlt: 'Pantalla de gran formato en un espacio interior',
    products: [
      { id: 'pantalla-43', name: 'Pantalla LED 43 pulgadas', detail: 'Full HD · incluye control', price: 180000 },
      { id: 'pantalla-55', name: 'Pantalla LED 55 pulgadas', detail: '4K · incluye control', price: 280000 },
      { id: 'pantalla-soporte', name: 'Soporte móvil para pantalla', detail: 'Altura ajustable · ruedas', price: 85000 },
    ],
  },
  {
    id: 'escritorios',
    name: 'Escritorios',
    description: 'Superficies de trabajo para stands y zonas administrativas.',
    image: imageUrl('photo-1497366754035-f200968a6e72'),
    imageAlt: 'Escritorios listos para una jornada de trabajo',
    products: [
      { id: 'escritorio-recto', name: 'Escritorio recto', detail: '120 × 60 cm · blanco', price: 85000 },
      { id: 'escritorio-ejecutivo', name: 'Escritorio ejecutivo', detail: '140 × 70 cm · acabado madera', price: 140000 },
      { id: 'mesa-plegable', name: 'Mesa plegable de apoyo', detail: '120 × 60 cm · estructura metálica', price: 55000 },
    ],
  },
  {
    id: 'barras',
    name: 'Barras',
    description: 'Módulos de servicio y superficies para atención al público.',
    image: imageUrl('photo-1514933651103-005eec06c04b'),
    imageAlt: 'Barra de servicio preparada en un espacio de atención',
    products: [
      { id: 'barra-lineal', name: 'Barra lineal', detail: '120 cm · frente neutro', price: 180000 },
      { id: 'barra-esquinera', name: 'Módulo esquinero', detail: '90 × 90 cm · acoplable', price: 145000 },
      { id: 'barra-completa', name: 'Barra de servicio', detail: '240 cm · dos módulos', price: 295000 },
    ],
  },
  {
    id: 'archiveros',
    name: 'Archiveros',
    description: 'Almacenamiento para material, documentos y elementos de apoyo.',
    image: imageUrl('photo-1595428774223-ef52624120d2'),
    imageAlt: 'Mueble de almacenamiento con repisas para organizar elementos',
    products: [
      { id: 'archivero-dos', name: 'Archivero de dos gavetas', detail: 'Vertical · cerradura incluida', price: 65000 },
      { id: 'archivero-cuatro', name: 'Archivero de cuatro gavetas', detail: 'Vertical · acabado gris', price: 92000 },
      { id: 'estante-apoyo', name: 'Estante de apoyo', detail: '5 niveles · estructura metálica', price: 78000 },
    ],
  },
]

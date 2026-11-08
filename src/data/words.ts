/**
 * Bancos de palabras por tema e idioma. Para agregar contenido basta ampliar estas listas
 * o crear otro banco; ningún modo de juego tiene palabras escritas dentro.
 */

export type Difficulty = 'facil' | 'medio' | 'dificil';

export interface WordBank {
  id: string;
  label: string;
  words: Record<Difficulty, readonly string[]>;
}

export const taqueria: WordBank = {
  id: 'es-mx-taqueria',
  label: 'Taquería',
  words: {
    facil: [
      'taco', 'salsa', 'queso', 'chile', 'sal', 'pan', 'agua', 'lima', 'mole', 'tamal', 'atole', 'frijol',
      'arroz', 'carne', 'res', 'pollo', 'cerdo', 'mesa', 'plato', 'vaso', 'cuenta', 'orden', 'tripa', 'pastor',
      'cebolla', 'cilantro', 'tomate', 'ajo', 'papa', 'sopa', 'caldo', 'crema', 'aceite', 'comal', 'trompo',
      'salero', 'jugo', 'hielo', 'dulce', 'fruta', 'piña', 'mango', 'pepino', 'nopal', 'elote', 'tinga', 'birria',
      'torta', 'tostada', 'taquero', 'cocina', 'mesero', 'tenedor', 'cuchara', 'bolillo', 'chorizo', 'huevo'
    ],
    medio: [
      'tortilla', 'guacamole', 'chicharrón', 'frijoles', 'nopales', 'jícama', 'pozole', 'huarache', 'quesadilla',
      'aguacate', 'jalapeño', 'habanero', 'serrano', 'chipotle', 'horchata', 'jamaica', 'tepache', 'refresco',
      'limón', 'maíz', 'campechano', 'consomé', 'barbacoa', 'cochinita', 'enchiladas', 'chilaquiles',
      'sincronizada', 'alambre', 'costilla', 'arrachera', 'bistec', 'longaniza', 'mañana', 'canción', 'corazón',
      'café', 'azúcar', 'canela', 'cajeta', 'churros', 'buñuelos', 'cabrito', 'machaca', 'tlayuda', 'tamarindo',
      'sandía', 'melón', 'plátano', 'cacahuate', 'ajonjolí', 'pimienta', 'orégano', 'epazote', 'rábano', 'pepián',
      'chayote', 'calabaza', 'tomatillo', 'vinagre'
    ],
    dificil: [
      'con todo', 'sin cebolla', 'para llevar', 'una orden de tacos', 'con mucho limón', 'bien picosito',
      'sin cilantro por favor', 'la cuenta por favor', 'dos de pastor', 'tres de suadero', 'salsa verde',
      'salsa roja', 'ándale pues', 'qué rico está', 'órale', 'no hay bronca', 'échale limón', 'qué padre',
      'está bien sabroso', 'una de campechano', 'con queso por favor', 'sin picante', 'extra salsa', 'taquería',
      'murciélago', 'ferrocarril', 'electrodoméstico', 'pingüino', 'vergüenza', 'cigüeña', 'paraguas',
      'cumpleaños', 'desayuno', 'aniversario', 'extraordinario', 'hipopótamo', 'arquitectura', 'tenochtitlán',
      'xochimilco', 'popocatépetl', 'cuauhtémoc', 'huitzilopochtli', 'quetzalcóatl', 'mazatlán', 'guanajuato',
      'michoacán', 'coyoacán'
    ]
  }
};

export const wordBanks: Record<string, WordBank> = {
  [taqueria.id]: taqueria
};

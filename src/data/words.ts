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
      'que', 'de', 'no', 'a', 'la', 'el', 'es', 'y', 'en', 'lo', 'un', 'por', 'qué', 'me', 'una', 'te', 'los', 'se', 'con', 'para', 'mi', 'si', 'bien', 'pero', 'yo', 'eso', 'las', 'sí', 'su', 'tu', 'aquí', 'del', 'al', 'como', 'le', 'más', 'esto', 'ya', 'todo', 'esta', 'vamos', 'muy', 'hay', 'ahora', 'algo', 'estoy', 'tengo', 'nos', 'tú', 'nada', 'cuando', 'ha', 'este', 'sé', 'así', 'puedo', 'quiero', 'solo', 'soy', 'tiene', 'gracias', 'o', 'él', 'bueno', 'fue', 'ser', 'hacer', 'son', 'todos', 'era', 'eres', 'vez', 'tienes', 'creo', 'ella', 'he', 'ese', 'voy', 'puede', 'sabes', 'hola', 'sus', 'porque', 'dios', 'quien', 'nunca', 'dónde', 'quieres', 'casa', 'favor', 'esa', 'dos', 'tan', 'señor', 'tiempo', 'verdad', 'estaba', 'mejor', 'va', 'hombre', 'usted', 'mucho', 'hace', 'entonces', 'siento', 'tenemos', 'puedes', 'ahí', 'ti', 'vida', 'ver', 'alguien', 'hasta', 'sin', 'mí', 'años', 'sobre', 'decir', 'uno', 'siempre', 'oh', 'ir', 'cosas', 'también', 'antes', 'has', 'ni', 'mis', 'día', 'estar', 'estamos', 'noche', 'nadie', 'otra', 'quiere', 'parece', 'nosotros', 'poco', 'padre', 'trabajo', 'gente', 'mira', 'vas', 'sea', 'les', 'donde', 'mismo', 'hecho', 'ellos', 'dije', 'pasa', 'dinero', 'hija', 'tal', 'otro', 'hablar', 'seguro', 'claro', 'estas', 'lugar', 'mundo', 'amigo', 'espero', 'han', 'tus', 'sabe', 'después', 'momento', 'desde', 'fuera', 'cosa', 'tipo', 'mañana', 'podemos', 'gran', 'necesito', 'estado', 'podría', 'acuerdo', 'papas', 'tener', 'dice', 'mía', 'crees', 'buena', 'gusta', 'nuestro', 'nuevo', 'será', 'haciendo', 'días', 'nombre',
    ],
    medio: [
      'tortilla', 'guacamole', 'chicharrón', 'frijoles', 'nopales', 'jícama', 'pozole', 'huarache', 'quesadilla',
      'aguacate', 'jalapeño', 'habanero', 'serrano', 'chipotle', 'horchata', 'jamaica', 'tepache', 'refresco',
      'limón', 'maíz', 'campechano', 'consomé', 'barbacoa', 'cochinita', 'enchiladas', 'chilaquiles',
      'sincronizada', 'alambre', 'costilla', 'arrachera', 'bistec', 'longaniza', 'mañana', 'canción', 'corazón',
      'café', 'azúcar', 'canela', 'cajeta', 'churros', 'buñuelos', 'cabrito', 'machaca', 'tlayuda', 'tamarindo',
      'sandía', 'melón', 'plátano', 'cacahuate', 'ajonjolí', 'pimienta', 'orégano', 'epazote', 'rábano', 'pepián',
      'chayote', 'calabaza', 'tomatillo', 'vinagre','que', 'de', 'no', 'a', 'la', 'el', 'es', 'y', 'en', 'lo', 'un', 'por', 'qué', 'me', 'una', 'te', 'los', 'se', 'con', 'para', 'mi', 'si', 'bien', 'pero', 'yo', 'eso', 'las', 'sí', 'su', 'tu', 'aquí', 'del', 'al', 'como', 'le', 'más', 'esto', 'ya', 'todo', 'esta', 'vamos', 'muy', 'hay', 'ahora', 'algo', 'estoy', 'tengo', 'nos', 'tú', 'nada', 'cuando', 'ha', 'este', 'sé', 'así', 'puedo', 'quiero', 'solo', 'soy', 'tiene', 'gracias', 'o', 'él', 'bueno', 'fue', 'ser', 'hacer', 'son', 'todos', 'era', 'eres', 'vez', 'tienes', 'creo', 'ella', 'he', 'ese', 'voy', 'puede', 'sabes', 'hola', 'sus', 'porque', 'dios', 'quien', 'nunca', 'dónde', 'quieres', 'casa', 'favor', 'esa', 'dos', 'tan', 'señor', 'tiempo', 'verdad', 'estaba', 'mejor', 'va', 'hombre', 'usted', 'mucho', 'hace', 'entonces', 'siento', 'tenemos', 'puedes', 'ahí', 'ti', 'vida', 'ver', 'alguien', 'hasta', 'sin', 'mí', 'años', 'sobre', 'decir', 'uno', 'siempre', 'oh', 'ir', 'cosas', 'también', 'antes', 'has', 'ni', 'mis', 'día', 'estar', 'estamos', 'noche', 'nadie', 'otra', 'quiere', 'parece', 'nosotros', 'poco', 'padre', 'trabajo', 'gente', 'mira', 'vas', 'sea', 'les', 'donde', 'mismo', 'hecho', 'ellos', 'dije', 'pasa', 'dinero', 'hija', 'tal', 'otro', 'hablar', 'seguro', 'claro', 'estas', 'lugar', 'mundo', 'amigo', 'espero', 'han', 'tus', 'sabe', 'después', 'momento', 'desde', 'fuera', 'cosa', 'tipo', 'mañana', 'podemos', 'gran', 'necesito', 'estado', 'podría', 'acuerdo', 'papas', 'tener', 'dice', 'mía', 'crees', 'buena', 'gusta', 'nuestro', 'nuevo', 'será', 'haciendo', 'días', 'nombre',
    ],
    dificil: [
      'con todo', 'sin cebolla', 'para llevar', 'una orden de tacos', 'con mucho limón', 'bien picosito',
      'sin cilantro por favor', 'la cuenta por favor', 'dos de pastor', 'tres de suadero', 'salsa verde',
      'salsa roja', 'ándale pues', 'qué rico está', 'órale', 'no hay bronca', 'échale limón', 'qué padre',
      'está bien sabroso', 'una de campechano', 'con queso por favor', 'sin picante', 'extra salsa', 'taquería',
      'murciélago', 'ferrocarril', 'electrodoméstico', 'paraguas',
      'cumpleaños', 'desayuno', 'aniversario', 'extraordinario', 'hipopótamo', 'arquitectura', 'tenochtitlán',
      'xochimilco', 'popocatépetl', 'cuauhtémoc', 'huitzilopochtli', 'quetzalcóatl', 'mazatlán', 'guanajuato',
      'michoacán', 'coyoacán'
    ]
  }
};

export const wordBanks: Record<string, WordBank> = {
  [taqueria.id]: taqueria
};

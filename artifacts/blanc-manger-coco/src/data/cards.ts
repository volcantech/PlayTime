export type CardCategory = "blanc" | "manger" | "coco";

export interface Card {
  id: number;
  category: CardCategory;
  question: string;
  hint?: string;
}

export const BLANC_CARDS: Card[] = [
  { id: 1, category: "blanc", question: "Quelle est la chose la plus bizarre que tu aies déjà mangée ?", hint: "Sois honnête !" },
  { id: 2, category: "blanc", question: "Quel est le mensonge le plus absurde que tu aies jamais dit pour éviter de sortir ?" },
  { id: 3, category: "blanc", question: "Quelle est la chose la plus embarrassante que tu aies faite devant quelqu'un que tu voulais impressionner ?" },
  { id: 4, category: "blanc", question: "Quel est ton talent caché le plus inutile ?" },
  { id: 5, category: "blanc", question: "Décris ta pire date en une phrase." },
  { id: 6, category: "blanc", question: "Quelle est la chose la plus stupide que tu aies achetée sur Internet à 3h du matin ?" },
  { id: 7, category: "blanc", question: "Quel est le surnom que tu n'aurais jamais voulu avoir ?" },
  { id: 8, category: "blanc", question: "Quelle est la chose la plus gênante que tes parents t'aient fait faire devant tes amis ?" },
  { id: 9, category: "blanc", question: "Raconte la fois où tu t'es le plus cru malin mais tu ne l'étais pas du tout." },
  { id: 10, category: "blanc", question: "Quelle est ta plus grande phobie absurde ?" },
  { id: 11, category: "blanc", question: "Si tu devais choisir un seul film à regarder pour le reste de ta vie, ce serait lequel ?" },
  { id: 12, category: "blanc", question: "Quel est le truc le plus enfantin que tu fasses encore ?" },
  { id: 13, category: "blanc", question: "Quelle est la chose la plus bizarre que tu fasses quand tu es seul·e ?" },
  { id: 14, category: "blanc", question: "Quel est ton pire souvenir scolaire ?" },
  { id: 15, category: "blanc", question: "As-tu déjà été viré·e ? Raconte !" },
  { id: 16, category: "blanc", question: "Quel est le truc le plus bizarre que tu aies retrouvé dans tes poches ?" },
  { id: 17, category: "blanc", question: "Quelle est la promesse que tu t'es faite et que tu n'as jamais tenue ?" },
  { id: 18, category: "blanc", question: "Si tu pouvais effacer un seul souvenir de ta mémoire, lequel serait-ce ?" },
  { id: 19, category: "blanc", question: "Quelle est ta plus grande addiction (avouable ou pas) ?" },
  { id: 20, category: "blanc", question: "Décris ton pire outfit que tu as vraiment porté fièrement ?" },
];

export const MANGER_CARDS: Card[] = [
  { id: 21, category: "manger", question: "Mange quelque chose de sucré et de salé en même temps sans grimacer." },
  { id: 22, category: "manger", question: "Bois un grand verre d'eau en moins de 30 secondes." },
  { id: 23, category: "manger", question: "Mange une cuillerée de quelque chose que tu n'aimes pas." },
  { id: 24, category: "manger", question: "Fais semblant que tu es à la télé et présente le plat que tu préfères comme un chef étoilé." },
  { id: 25, category: "manger", question: "Mange lentement un aliment pendant que tout le monde te regarde sans rien dire." },
  { id: 26, category: "manger", question: "Imite le cri d'un animal de ferme pendant 10 secondes, les autres doivent deviner lequel." },
  { id: 27, category: "manger", question: "Fais manger quelque chose à la personne à ta gauche, les yeux fermés." },
  { id: 28, category: "manger", question: "Mange avec les mains derrière le dos pour 30 secondes." },
  { id: 29, category: "manger", question: "Goûte quelque chose au choix du groupe, sans voir ce que c'est." },
  { id: 30, category: "manger", question: "Régale-toi d'un aliment bizarre proposé par le groupe en 15 secondes." },
  { id: 31, category: "manger", question: "Cuisine quelque chose avec ce qui se trouve dans le frigo et explique la recette aux autres." },
  { id: 32, category: "manger", question: "Commande ou sers à boire pour tout le groupe, à ta façon." },
  { id: 33, category: "manger", question: "Mange quelque chose de la couleur désignée par la personne à ta droite." },
  { id: 34, category: "manger", question: "Fais la critique gastronomique de ce que tu es en train de manger/boire avec un accent sophistiqué." },
  { id: 35, category: "manger", question: "Mange une nourriture froide comme si c'était la chose la plus chaude du monde." },
  { id: 36, category: "manger", question: "Prépare et mange un sandwich en moins d'une minute." },
  { id: 37, category: "manger", question: "Propose un toast à quelqu'un dans la pièce et expliquez pourquoi avec 3 compliments." },
  { id: 38, category: "manger", question: "Mange quelque chose qu'un autre joueur désigne dans les provisions disponibles." },
  { id: 39, category: "manger", question: "Fais semblant que la prochaine chose que tu manges est la plus délicieuse chose du monde." },
  { id: 40, category: "manger", question: "Mange quelque chose en tenant l'emballage entre tes dents." },
];

export const COCO_CARDS: Card[] = [
  { id: 41, category: "coco", question: "Envoie un message bizarre à la dernière personne de tes contacts et lis la réponse à voix haute." },
  { id: 42, category: "coco", question: "Fais une déclaration d'amour passionnée à un objet de ton choix." },
  { id: 43, category: "coco", question: "Appelle quelqu'un que tu n'as pas contacté depuis plus d'un an et dis-lui que tu penses souvent à lui/elle." },
  { id: 44, category: "coco", question: "Poste un selfie avec une expression absurde sur tes réseaux." },
  { id: 45, category: "coco", question: "Raconte un secret que tout le monde dans la pièce peut entendre." },
  { id: 46, category: "coco", question: "Fais un compliment sincère à chaque joueur en 1 phrase chacun." },
  { id: 47, category: "coco", question: "Chante le refrain de la dernière chanson que tu écoutais." },
  { id: 48, category: "coco", question: "Laisse la personne à ta gauche lire tes 3 derniers messages envoyés à voix haute." },
  { id: 49, category: "coco", question: "Montre la dernière photo de ta galerie sans la regarder avant." },
  { id: 50, category: "coco", question: "Imite la voix de quelqu'un dans la pièce et les autres doivent deviner qui c'est." },
  { id: 51, category: "coco", question: "Dis ce que tu penses vraiment de la tenue de la personne en face de toi." },
  { id: 52, category: "coco", question: "Fais une danse d'au moins 30 secondes sans musique." },
  { id: 53, category: "coco", question: "Révèle le dernier mensonge que tu as dit (aussi petit soit-il)." },
  { id: 54, category: "coco", question: "Laisse les autres te coiffer comme ils veulent pendant 2 minutes." },
  { id: 55, category: "coco", question: "Lis à voix haute le dernier message vocal que tu as reçu." },
  { id: 56, category: "coco", question: "Fais un discours de 1 minute sur pourquoi tu serais un excellent président/présidente." },
  { id: 57, category: "coco", question: "Montre la recherche la plus bizarre que tu as faite sur Google récemment." },
  { id: 58, category: "coco", question: "Laisse la personne à ta droite choisir ton statut WhatsApp pour la soirée." },
  { id: 59, category: "coco", question: "Imite un personnage de film en restant dans ce rôle pendant 3 minutes." },
  { id: 60, category: "coco", question: "Raconte ton rêve le plus étrange de la semaine passée." },
];

export const ALL_CARDS: Card[] = [...BLANC_CARDS, ...MANGER_CARDS, ...COCO_CARDS];

export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const CATEGORY_CONFIG = {
  blanc: {
    label: "BLANC",
    color: "bg-blue-100 border-blue-300 text-blue-800",
    bgCard: "bg-blue-50",
    headerBg: "bg-blue-500",
    emoji: "❓",
    description: "Question intime",
    pointValue: 2,
  },
  manger: {
    label: "MANGER",
    color: "bg-orange-100 border-orange-300 text-orange-800",
    bgCard: "bg-orange-50",
    headerBg: "bg-orange-500",
    emoji: "🍽️",
    description: "Défi culinaire",
    pointValue: 1,
  },
  coco: {
    label: "COCO",
    color: "bg-pink-100 border-pink-300 text-pink-800",
    bgCard: "bg-pink-50",
    headerBg: "bg-pink-500",
    emoji: "🥥",
    description: "Action / gage",
    pointValue: 3,
  },
} as const;

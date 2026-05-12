export interface Avatar {
  emoji: string;
  label: string;
}

export const AVATARS: Avatar[] = [
  { emoji: "🐱", label: "Chat" },
  { emoji: "🐶", label: "Chien" },
  { emoji: "🦊", label: "Renard" },
  { emoji: "🐻", label: "Ours" },
  { emoji: "🐼", label: "Panda" },
  { emoji: "🐨", label: "Koala" },
  { emoji: "🐯", label: "Tigre" },
  { emoji: "🦁", label: "Lion" },
  { emoji: "🐺", label: "Loup" },
  { emoji: "🦝", label: "Raton" },
  { emoji: "🐮", label: "Vache" },
  { emoji: "🐷", label: "Cochon" },
  { emoji: "🐸", label: "Grenouille" },
  { emoji: "🐧", label: "Pingouin" },
  { emoji: "🦆", label: "Canard" },
  { emoji: "🦉", label: "Hibou" },
  { emoji: "🦔", label: "Hérisson" },
  { emoji: "🐭", label: "Souris" },
  { emoji: "🐰", label: "Lapin" },
  { emoji: "🐙", label: "Pieuvre" },
  { emoji: "🦄", label: "Licorne" },
  { emoji: "🐲", label: "Dragon" },
  { emoji: "👻", label: "Fantôme" },
  { emoji: "🤖", label: "Robot" },
  { emoji: "👾", label: "Alien" },
  { emoji: "🎃", label: "Citrouille" },
  { emoji: "🧸", label: "Nounours" },
  { emoji: "🦸", label: "Super-héros" },
  { emoji: "🧙", label: "Sorcier" },
  { emoji: "🧚", label: "Fée" },
];

export const DEFAULT_AVATAR = AVATARS[0].emoji;

import { BookOpen, Coffee, CookingPot, Dumbbell, Flower2, Gift, Headphones, Image, Lamp, NotebookPen, Puzzle, Sparkles, Ticket, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { type IdeaIcon, ideaIcon } from "@/lib/idea-icon";

const ICONS: Record<IdeaIcon, LucideIcon> = {
  kitchen: CookingPot, ticket: Ticket, experience: Sparkles, notebook: NotebookPen, book: BookOpen, tech: Headphones,
  sport: Dumbbell, tools: Wrench, game: Puzzle, drink: Coffee, beauty: Flower2, home: Lamp, wallet: Wallet, photo: Image, gift: Gift,
};

export function GiftIdeaIcon({ idea }: { idea: { name: string; query?: string } }) {
  const kind = ideaIcon(idea);
  const Icon = ICONS[kind];
  return <span className={`gift-idea-icon gift-idea-icon--${kind}`} aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>;
}

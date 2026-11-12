import { getStory } from "@/lib/data";
import { NotFoundMsg } from "@/components/bits";
import { StoryView } from "@/components/StoryView";

export const metadata = { title: "Zajímavosti" };

export default async function CuriositiesPage() {
  const story = await getStory("zajimavosti");
  if (!story) return <NotFoundMsg what="Text" />;
  return <StoryView story={story} fallbackTitle="Zajímavosti" />;
}

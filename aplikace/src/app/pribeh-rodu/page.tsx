import { getStory } from "@/lib/data";
import { NotFoundMsg } from "@/components/bits";
import { StoryView } from "@/components/StoryView";

export const metadata = { title: "Příběh rodu" };

export default async function FamilyStoryPage() {
  const story = await getStory("pribeh");
  if (!story) return <NotFoundMsg what="Příběh" />;
  return <StoryView story={story} fallbackTitle="Příběh rodu" back={{ href: "/pribehy/", label: "Příběhy" }} />;
}

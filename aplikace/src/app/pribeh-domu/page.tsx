import { getStory } from "@/lib/data";
import { NotFoundMsg } from "@/components/bits";
import { StoryView } from "@/components/StoryView";

export const metadata = { title: "Příběh domu" };

export default async function HouseStoryPage() {
  const story = await getStory("pribeh-domu");
  if (!story) return <NotFoundMsg what="Příběh" />;
  return <StoryView story={story} fallbackTitle="Příběh domu" back={{ href: "/pribehy/", label: "Příběhy" }} />;
}

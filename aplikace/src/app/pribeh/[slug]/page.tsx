import { getStory } from "@/lib/data";
import { NotFoundMsg } from "@/components/bits";
import { StoryView } from "@/components/StoryView";

export default async function StoryPage({ params }: PageProps<"/pribeh/[slug]">) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return <NotFoundMsg what="Příběh" />;
  return <StoryView story={story} fallbackTitle="Příběh" back={{ href: "/pribehy/", label: "Příběhy" }} />;
}

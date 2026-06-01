import { redirect } from "next/navigation";

// Merged into the NumPy lessons curriculum. Keep this route as a redirect so old
// links (and the previous nav entry) land on the new home for this content.
export default function StartFromScratchPage() {
  redirect("/numpy/lessons");
}

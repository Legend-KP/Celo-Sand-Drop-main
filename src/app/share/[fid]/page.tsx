import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_URL, APP_NAME, APP_DESCRIPTION } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";

type Props = {
  params: Promise<{ fid: string }>;
  searchParams?: Promise<{ fp?: string; t?: string }>; // ADD 't' parameter
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { fid } = await params;
  const resolvedSearchParams = await searchParams;
  const flowPoints = resolvedSearchParams?.fp || '0';
  const timestamp = resolvedSearchParams?.t || Date.now().toString(); // Get timestamp

  // Include both flowPoints AND timestamp in thumbnail URL
  // This forces Farcaster to fetch a fresh image instead of using cached one
  const thumbnailUrl = `${APP_URL}/api/thumbnail?fid=${fid}&fp=${flowPoints}&t=${timestamp}`;

  return {
    title: `${APP_NAME} - Share`,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [thumbnailUrl],
    },
    other: {
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(thumbnailUrl)),
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(thumbnailUrl)),
    },
  };
}

export default function SharePage() {
  redirect("/");
}
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { APP_URL } from '~/lib/constants';
import { getMiniAppEmbedMetadata } from '~/lib/utils';

const METADATA_BASE_URI = "https://scarlet-voluntary-angelfish-357.mypinata.cloud/ipfs/bafybeib2t7nswskummb5zjetzyd3fp5rvtplj2dhtyycpddjfvxckcckue/";

type Props = {
  params: Promise<{ tokenId: string }>;
  searchParams?: Promise<{ image?: string; day?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { tokenId } = await params;
  const resolvedSearchParams = await searchParams;
  
  let nftImageUrl = resolvedSearchParams?.image || '';
  const day = resolvedSearchParams?.day || (parseInt(tokenId) + 1).toString();
  
  // ✅ Fetch metadata if image not provided
  if (!nftImageUrl) {
    try {
      const metadataCid = `bafybeib2t7nswskummb5zjetzyd3fp5rvtplj2dhtyycpddjfvxckcckue/${tokenId}`;
      
      // ✅ Use absolute URL for metadata fetch
      const metadataUrl = `${APP_URL}/api/ipfs?cid=${metadataCid}`;
      
      console.log(`🖼️ Fetching metadata from: ${metadataUrl}`);
      
      const response = await fetch(metadataUrl, {
        next: { revalidate: 86400 },
      });
      
      if (response.ok) {
        const metadata = await response.json();
        nftImageUrl = metadata.image || '';
        console.log(`✅ Got image URL: ${nftImageUrl}`);
      }
    } catch (error) {
      console.error('❌ Metadata fetch failed:', error);
    }
  }
  
  // ✅ CRITICAL FIX: Convert to absolute URL for thumbnail API
  if (nftImageUrl) {
    // If it's a relative URL (starts with /api/ipfs)
    if (nftImageUrl.startsWith('/api/ipfs')) {
      nftImageUrl = `${APP_URL}${nftImageUrl}`;
      console.log(`🔄 Converted relative to absolute: ${nftImageUrl}`);
    }
    // If it's a Pinata URL, convert to proxy
    else if (nftImageUrl.includes('scarlet-voluntary-angelfish-357.mypinata.cloud/ipfs/')) {
      const cidMatch = nftImageUrl.match(/\/ipfs\/(.+)$/);
      if (cidMatch) {
        nftImageUrl = `${APP_URL}/api/ipfs?cid=${cidMatch[1]}`;
      }
    }
    // If it's ipfs:// protocol
    else if (nftImageUrl.startsWith('ipfs://')) {
      const cid = nftImageUrl.replace('ipfs://', '').replace(/^ipfs\//, '');
      nftImageUrl = `${APP_URL}/api/ipfs?cid=${cid}`;
    }
  }
  
  const timestamp = Date.now().toString();
  const thumbnailUrl = `${APP_URL}/api/nft-thumbnail?image=${encodeURIComponent(nftImageUrl)}&tokenId=${tokenId}&day=${day}&t=${timestamp}`;
  
  console.log(`📸 Final thumbnail URL: ${thumbnailUrl}`);
  console.log(`📸 Image URL being passed: ${nftImageUrl}`);

  return {
    title: `Flow State NFT - Day ${day}`,
    description: `Just got my 'Daily Reminder to Flow' NFT by @trenchverse! Get yours...`,
    openGraph: {
      title: `Flow State NFT - Day ${day}`,
      description: `Just got my 'Daily Reminder to Flow' NFT by @trenchverse! Get yours...`,
      images: [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 630,
          alt: `Flow State NFT - Day ${day}`,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Flow State NFT - Day ${day}`,
      description: `Just got my 'Daily Reminder to Flow' NFT by @trenchverse!`,
      images: [thumbnailUrl],
    },
    other: {
      "fc:frame": JSON.stringify({
        ...getMiniAppEmbedMetadata(thumbnailUrl),
        button: {
          ...getMiniAppEmbedMetadata(thumbnailUrl).button,
          title: "Mint Yours for Free!", // Custom button title for NFT shares
        },
      }),
      "fc:miniapp": JSON.stringify({
        ...getMiniAppEmbedMetadata(thumbnailUrl),
        button: {
          ...getMiniAppEmbedMetadata(thumbnailUrl).button,
          title: "Mint Yours for Free!", // Custom button title for NFT shares
        },
      }),
    },
  };
}

export default function NFTSharePage() {
  redirect("/");
}

import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const transcriptResponse = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptResponse
      .map(item => item.text)
      .join(' ');

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
} 
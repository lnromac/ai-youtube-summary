'use client'

import { useState } from 'react';

const preprocessTranscript = (transcript: string): string => {
  return transcript
    // Remove timestamps if they exist
    .replace(/\[\d{2}:\d{2}\.\d{3}\]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove speaker labels if they exist (common in YouTube transcripts)
    .replace(/^[A-Za-z]+:/gm, '')
    // Remove redundant punctuation
    .replace(/[.]{2,}/g, '.')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    // Remove empty lines
    .replace(/^\s*[\r\n]/gm, '')
    .trim();
};

const getSummary = async (youtubeVideo: string, setSummary: (summary: string) => void) => {
  try {
    // Extract video ID from YouTube URL
    const videoId = youtubeVideo.split('v=')[1]?.split('&')[0];
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Fetch transcript
    const transcriptResponse = await fetch(`/api/transcript?videoId=${videoId}`);
    const { transcript } = await transcriptResponse.json();
    console.log(transcript, 'hey');
    if (!transcript) {
      throw new Error('Could not fetch transcript');
    }

    // Preprocess the transcript
    const cleanedTranscript = preprocessTranscript(transcript);

    // Split into chunks
    const chunkSize = 2000;
    const chunks = cleanedTranscript.match(new RegExp(`.{1,${chunkSize}}(?:[.!?]|$)`, 'g')) || [];
    
    let fullSummary = '';
    let retryDelay = 2000;

    // Process each chunk directly (removed consolidation logic)
    for (const chunk of chunks) {
      let success = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!success && attempts < maxAttempts) {
        try {
          setSummary(`Processing section ${chunks.indexOf(chunk) + 1}/${chunks.length}...`);
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { 
                  role: 'system', 
                  content: `Analyze this video transcript section and provide a structured summary following these guidelines:
- Extract 3-5 key points from this section
- Format each point as a bullet point starting with "•"
- Focus on concrete information, facts, and main ideas
- Ignore repetitive content and filler words
- Keep each point concise but informative
- Maintain chronological order if relevant`
                },
                { 
                  role: 'user', 
                  content: chunk 
                }
              ]
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          fullSummary += data.choices[0].message.content + ' ';
          success = true;

          // Reset delay after successful request
          retryDelay = 1000;
          
          // Wait longer between successful requests
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) throw error;
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2; // Double the delay for next attempt
          console.log(`Retrying request (attempt ${attempts + 1}/${maxAttempts})...`);
        }
      }
    }

    setSummary(fullSummary.trim());
  } catch (error) {
    console.error(error);
    setSummary('Error: ' + (error as Error).message);
  }
}

export default function Home() {
  const [youtubeVideo, setYoutubeVideo] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await getSummary(youtubeVideo, setSummary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-rows-[auto_1fr] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-4xl font-bold">AI Youtube Summarizer</h1>
      
      <div className="w-full max-w-2xl space-y-6">
        <input 
          type="text" 
          placeholder="Enter Youtube Video URL" 
          value={youtubeVideo} 
          onChange={(e) => setYoutubeVideo(e.target.value)}
          className="w-full p-3 border rounded-lg"
          disabled={isLoading}
        />
        
        <button 
          onClick={handleGetSummary}
          disabled={isLoading || !youtubeVideo}
          className={`w-full p-3 rounded-lg bg-blue-500 text-white font-medium
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
        >
          {isLoading ? 'Generating Summary...' : 'Get Summary'}
        </button>

        {error && (
          <div className="p-4 text-red-500 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {summary && !error && (
          <div className="p-6 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="text-gray-700 space-y-2">
              {summary.split('•').filter(point => point.trim()).map((point, index) => (
                <p key={index} className="pl-4">
                  • {point.trim()}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
